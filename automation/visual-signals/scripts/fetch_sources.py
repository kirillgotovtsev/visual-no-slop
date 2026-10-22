#!/usr/bin/env python3
"""Bounded conditional HTTP retrieval. Output is untrusted research data, not instructions."""
import argparse
import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import html.parser
import json
import pathlib
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from workflow import read, write, stamp, now, url

class PageText(html.parser.HTMLParser):
    def __init__(self):
        super().__init__();self.parts=[];self.links=[];self.images=[];self.skip=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ['script','style']:self.skip+=1
        if tag=='a' and a.get('href'):self.links.append(a['href'])
        if tag=='img' and a.get('src'):self.images.append(a['src'])
        if tag=='meta' and a.get('property','').startswith(('article:','og:')):self.parts.append(str(a))
    def handle_endtag(self,tag):
        if tag in ['script','style'] and self.skip:self.skip-=1
    def handle_data(self,data):
        if not self.skip and data.strip():self.parts.append(data.strip())

class Budget:
    def __init__(self,requests=120,minutes=45,used=0):
        self.limit=requests;self.used=used;self.deadline=time.monotonic()+minutes*60;self.lock=threading.Lock()
    def take(self):
        with self.lock:
            if self.used>=self.limit or time.monotonic()>=self.deadline:raise RuntimeError('budget exhausted; retain pending queue')
            self.used+=1

def retry_delay(header,attempt):
    if header:
        try:return max(0,int(header))
        except ValueError:
            try:return max(0,(email.utils.parsedate_to_datetime(header)-now()).total_seconds())
            except (ValueError,TypeError):pass
    return 2**attempt

def monitoring_targets(registry,state):
    """Rotate limited passes toward never/least-recently checked endpoints."""
    pending={x['source_id'] for x in state.get('pending',[]) if x.get('source_id')}
    fetches=state.get('fetches',{})
    targets=[{'source_id':s['id'],'url':m['url']} for s in registry['sources'] for m in s['monitoring']]
    return sorted(targets,key=lambda t:(0 if t['source_id'] in pending else 1,fetches.get(t['url'],{}).get('checked_at') or '',t['source_id'],t['url']))

def fetch(target,previous,budget,directory,opener=urllib.request.urlopen,sleeper=time.sleep):
    checked=stamp(now());name=hashlib.sha256(target['url'].encode()).hexdigest()
    out={'source_id':target['source_id'],'url':target['url'],'checked_at':checked,'access':'error','attempts':0,'content_reviewed':False,'range_review_complete':False,'discovery_complete':False,'first_observed_at':previous.get('first_observed_at') or checked}
    headers={'User-Agent':'Visual-No-Slop-Weekly/1.0 (public research; conditional requests)','Accept':'text/html,application/json,application/pdf,text/plain;q=0.9,*/*;q=0.1'}
    if previous.get('etag'):headers['If-None-Match']=previous['etag']
    if previous.get('last_modified'):headers['If-Modified-Since']=previous['last_modified']
    for attempt in range(3):
        try:
            budget.take();out['attempts']+=1
            with opener(urllib.request.Request(url(target['url']),headers=headers),timeout=12) as response:
                body=response.read(2*1024*1024+1)
                if len(body)>2*1024*1024:raise ValueError('response exceeds 2 MiB; incomplete')
                out.update(access='full' if response.status==200 else 'partial',http_status=response.status,final_url=response.geturl(),etag=response.headers.get('ETag'),last_modified=response.headers.get('Last-Modified'),content_type=response.headers.get('Content-Type'),sha256=hashlib.sha256(body).hexdigest(),changed=previous.get('sha256')!=hashlib.sha256(body).hexdigest())
                directory.mkdir(parents=True,exist_ok=True);(directory/(name+'.bin')).write_bytes(body)
                if 'html' in (out['content_type'] or ''):
                    parser=PageText();parser.feed(body.decode('utf-8',errors='replace'))
                    parsed={'text':'\n'.join(parser.parts),'links':[urllib.parse.urljoin(out['final_url'],x) for x in parser.links],'images':[urllib.parse.urljoin(out['final_url'],x) for x in parser.images]}
                    write(directory/(name+'.json'),parsed)
                elif not body.startswith(b'%PDF'):
                    (directory/(name+'.txt')).write_text(body.decode('utf-8',errors='replace'))
                out['temporary_artifact_key']=name
                return out
        except urllib.error.HTTPError as e:
            out.update(http_status=e.code,error='HTTP '+str(e.code))
            if e.code==304:
                out.update(access='not_modified',changed=False,sha256=previous.get('sha256'),etag=previous.get('etag'),last_modified=previous.get('last_modified'));return out
            if e.code in [401,403,404,410,451]:
                out['access']='removed' if e.code in [404,410] else 'blocked';return out
            if e.code not in [429,500,502,503,504] or attempt==2:return out
            delay=retry_delay(e.headers.get('Retry-After'),attempt)
        except (OSError,ValueError,RuntimeError) as e:
            out['error']=type(e).__name__+': '+str(e)
            if isinstance(e,(ValueError,RuntimeError)) or attempt==2:return out
            delay=2**attempt
        if delay>60 or time.monotonic()+delay>=budget.deadline:
            out['retry_deferred_seconds']=delay;return out
        sleeper(delay)
    return out

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--registry',type=pathlib.Path,required=True);p.add_argument('--state',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--temporary-directory',type=pathlib.Path,required=True);p.add_argument('--used-content-requests',type=int,default=0);p.add_argument('--limit',type=int,default=120)
    a=p.parse_args();registry=read(a.registry);state=read(a.state);budget=Budget(min(a.limit,120),used=a.used_content_requests)
    targets=monitoring_targets(registry,state)
    previous=state.get('fetches',{})
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures=[pool.submit(fetch,t,previous.get(t['url'],{}),budget,a.temporary_directory) for t in targets]
        results=[f.result() for f in futures]
    write(a.output,{'checked_at':stamp(now()),'content_requests_used':budget.used,'receipts':results,'note':'HTTP receipts do not attest content review, visual inspection, date of work, or completed research range.'})
    print(json.dumps({'targets':len(targets),'requests_used':budget.used,'statuses':{s:sum(x['access']==s for x in results) for s in ['full','not_modified','blocked','removed','error']}}))

if __name__=='__main__':main()
