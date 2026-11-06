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
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from workflow import DISCOVERY_KINDS, moment, now, read, stamp, url, write

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
        self.limit = requests
        self.used = used
        self.deadline = time.monotonic() + minutes * 60
        self.lock = threading.Lock()

    def take(self):
        with self.lock:
            seconds_left = self.deadline - time.monotonic()
            if self.used >= self.limit or seconds_left <= 0:
                raise RuntimeError('budget exhausted; retain pending queue')
            self.used += 1
            return min(12, seconds_left)

class MeteredRequests(urllib.request.BaseHandler):
    """Charge each outbound request, including redirects followed by urllib."""
    def __init__(self, charge):
        self.charge = charge

    def https_request(self, request):
        url(request.full_url)
        request.timeout = self.charge()
        return request

    http_request = ftp_request = https_request

def retry_delay(header,attempt):
    if header:
        try:return max(0,int(header))
        except ValueError:
            try:return max(0,(email.utils.parsedate_to_datetime(header)-now()).total_seconds())
            except (ValueError,TypeError):pass
    return 2**attempt

def monitoring_targets(registry, state, at=None, baseline_recheck_days=28):
    """Queue live discovery before due baseline pages. Git blobs use the exact-revision path."""
    at = at or now()
    recheck_before = (at.date() - dt.timedelta(days=baseline_recheck_days)).isoformat()
    fetches = state.get('fetches', {})
    targets = []
    for source in registry['sources']:
        for point in source['monitoring']:
            kind = point.get('kind', 'page')
            if kind == 'git_file':
                continue
            checked_at = fetches.get(point['url'], {}).get('checked_at') or ''
            live = kind in DISCOVERY_KINDS
            if live or checked_at[:10] <= recheck_before:
                targets.append({'source_id': source['id'], 'url': point['url'], 'conditional': not live})
    return sorted(targets, key=lambda target: (target['conditional'],
                  fetches.get(target['url'], {}).get('checked_at') or '', target['source_id'], target['url']))

def fetch(target,previous,budget,directory,opener=None,sleeper=time.sleep,retries=2):
    checked=stamp(now());name=hashlib.sha256(target['url'].encode()).hexdigest()
    out={'source_id':target['source_id'],'url':target['url'],'checked_at':checked,'access':'error','attempts':0,'content_reviewed':False,'range_review_complete':False,'discovery_complete':False,'first_observed_at':previous.get('first_observed_at') or checked}
    headers={'User-Agent':'Visual-No-Slop-Weekly/1.0 (public research; conditional requests)','Accept':'text/html,application/json,application/pdf,text/plain;q=0.9,*/*;q=0.1'}
    if target.get('conditional', True):
        if previous.get('etag'):headers['If-None-Match']=previous['etag']
        if previous.get('last_modified'):headers['If-Modified-Since']=previous['last_modified']

    def charge():
        timeout = budget.take()
        out['attempts'] += 1
        return timeout

    if opener is None:
        open_request = urllib.request.build_opener(MeteredRequests(charge)).open
    else:
        def open_request(request):
            return opener(request, timeout=charge())

    for attempt in range(retries+1):
        try:
            with open_request(urllib.request.Request(url(target['url']),headers=headers)) as response:
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
            if e.code not in [429,500,502,503,504] or attempt==retries:return out
            delay=retry_delay(e.headers.get('Retry-After'),attempt)
        except (OSError,ValueError,RuntimeError) as e:
            out['error']=type(e).__name__+': '+str(e)
            if isinstance(e,(ValueError,RuntimeError)) or attempt==retries:return out
            delay=2**attempt
        if delay>60 or time.monotonic()+delay>=budget.deadline:
            out['retry_deferred_seconds']=delay;return out
        if budget.used >= budget.limit:
            return out
        sleeper(delay)
    return out

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--registry', type=pathlib.Path, required=True)
    parser.add_argument('--state', type=pathlib.Path, required=True)
    parser.add_argument('--config', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[1]/'config.json')
    parser.add_argument('--output', type=pathlib.Path, required=True)
    parser.add_argument('--temporary-directory', type=pathlib.Path, required=True)
    parser.add_argument('--started-at', help='UTC start of the shared research timer')
    parser.add_argument('--used-content-requests', type=int, default=0)
    parser.add_argument('--used-monitoring-requests', type=int, default=0)
    parser.add_argument('--limit', type=int, help='Absolute content-request ceiling, including prior requests')
    args = parser.parse_args(argv)
    config = read(args.config)
    budgets, policy = config['budgets'], config['research']
    used, used_monitoring = args.used_content_requests, args.used_monitoring_requests
    if not 0 <= used_monitoring <= used or (args.limit is not None and args.limit < 0):
        parser.error('request counts must be nonnegative and monitoring counts are part of total content requests')
    at = now()
    started = moment(args.started_at) if args.started_at else at
    if started > at:
        parser.error('research timer start is in the future')
    minutes_left = budgets['minutes'] - (at - started).total_seconds()/60
    total_cap = budgets['content_requests'] if args.limit is None else min(args.limit, budgets['content_requests'])
    monitoring_left = max(0, policy['monitoring_requests'] - used_monitoring)
    budget = Budget(min(total_cap, used + monitoring_left), minutes_left, used)
    registry, state = read(args.registry), read(args.state)
    targets = monitoring_targets(registry, state, at, policy['baseline_recheck_days'])
    previous = state.get('fetches', {})
    slots = max(0, budget.limit - used) if minutes_left > 0 else 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=budgets['max_concurrent_requests']) as pool:
        futures = [pool.submit(fetch, target, previous.get(target['url'], {}), budget,
                               args.temporary_directory, retries=budgets['temporary_error_retries'])
                   for target in targets[:slots]]
        results = [future.result() for future in futures]
    results = [result for result in results if result['attempts']]

    summary = {'targets': len(targets), 'attempted_targets': len(results),
               'deferred_targets': len(targets) - len(results),
               'monitoring_requests_used': used_monitoring + budget.used - used}
    write(args.output, {**summary, 'checked_at': stamp(now()), 'content_requests_used': budget.used,
          'receipts': results, 'note': 'HTTP receipts do not attest content review, visual inspection, date of work, or completed research range.'})
    statuses = {status: sum(result['access'] == status for result in results)
                for status in ('full', 'not_modified', 'blocked', 'removed', 'error')}
    print(json.dumps({**summary, 'requests_used': budget.used, 'statuses': statuses}))

if __name__=='__main__':main()
