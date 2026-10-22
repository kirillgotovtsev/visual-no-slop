#!/usr/bin/env python3
"""Deterministic support for a model-led cloud research pass. No model API or credentials."""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import re
import subprocess
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[3]
BASE = pathlib.Path('automation/visual-signals')
CONSUMER = 'skills/visual-no-slop/references/current-signals.md'
REPO = 'https://github.com/kirillgotovtsev/visual-no-slop'
TIME_RE = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
SHA_RE = re.compile(r'^[0-9a-f]{40}$')
RUN_RE = re.compile(r'^(?:setup-)?\d{4}-W\d{2}(?:-[a-z0-9-]+)?$')
LOCAL_PATH_RE = re.compile('/' + r'Users/|/' + r'private/tmp/|/' + r'home/[^ /]+/')

class Invalid(ValueError):
    pass

def require(value, message):
    if not value:
        raise Invalid(message)

def pairs(items):
    out = {}
    for key, value in items:
        require(key not in out, 'duplicate JSON key: ' + key)
        out[key] = value
    return out

def read(path):
    return json.loads(pathlib.Path(path).read_text(), object_pairs_hook=pairs)

def write(path, data):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)

def stamp(value):
    return value.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def moment(value, nullable=False):
    if value is None and nullable:
        return None
    require(isinstance(value, str) and TIME_RE.fullmatch(value), 'UTC timestamp required: ' + str(value))
    try:
        return dt.datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc)
    except ValueError as e:
        raise Invalid(str(e)) from e

def date_or_time(value):
    if value is None:
        return None
    if isinstance(value, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        return dt.datetime.combine(dt.date.fromisoformat(value), dt.time(), dt.timezone.utc)
    return moment(value)

def url(value):
    require(isinstance(value, str), 'URL must be a string')
    u = urlsplit(value)
    require(u.scheme == 'https' and u.hostname and not u.username and not u.password, 'public HTTPS URL required')
    require(u.hostname not in {'localhost', '127.0.0.1', '::1'} and not u.hostname.endswith('.local'), 'local URL forbidden')
    return value

def text(value, field, minimum=12):
    require(isinstance(value, str) and len(value.strip()) >= minimum, field + ': substantive text required')
    require(not LOCAL_PATH_RE.search(value) and not re.search(r'(?i)(file:|[\x00-\x08]|(?:send|reveal|upload).{0,30}(?:token|secret|password)|ignore (?:all |previous )?instructions|git push|curl |sudo )', value), field + ': unsafe instruction or local path')
    return value

def unique(items, kind):
    require(isinstance(items, list), kind + ' must be a list')
    out = {}
    for item in items:
        require(isinstance(item, dict), kind + ' entry must be an object')
        key = item.get('id')
        require(isinstance(key, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{1,79}', key), kind + ': bad ID')
        require(key not in out, kind + ': duplicate ID ' + key)
        out[key] = item
    return out

def sha256(data):
    return hashlib.sha256(data).hexdigest()

def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()

def protected_hashes(root):
    names = [str(BASE / p) for p in ['config.json', 'sources.json', 'RUNBOOK.md', 'SCHEDULED_PROMPT.txt']]
    names += [str(p.relative_to(root)) for p in (root / BASE / 'scripts').glob('*.py')]
    names += [str(p.relative_to(root)) for p in (root / BASE / 'tests').glob('*.py')]
    return {p: sha256((root / p).read_bytes()) for p in sorted(names)}

def validate_sources(data):
    require(data.get('schema_version') == 1, 'unsupported sources schema')
    sources = unique(data.get('sources'), 'source')
    original = [f'{letter}{i:02}' for letter, count in [('A',15),('B',15),('C',4),('D',9),('E',16)] for i in range(1,count+1)]
    require(set(original) <= sources.keys(), 'historical registry incomplete')
    for source in sources.values():
        for key in ['title', 'author_or_publisher', 'role', 'limitations', 'retrieval', 'weekly_role']:
            text(source.get(key), 'source.' + key, 2)
        date_or_time(source.get('published_at'))
        require(source.get('weekly_role') in ['static_baseline_conditional','discovery_and_comparison'], 'unknown monitoring role')
        require(isinstance(source.get('independence'), dict), 'source lineage required')
        require(source.get('urls') and source.get('monitoring'), 'source URLs and monitoring required')
        for target in source['urls'] + source['monitoring']:
            url(target.get('url'))
    return sources

def validate(config, registry, data, state=None, at=None, publication=False):
    at = at or now()
    require(config.get('schema_version') == 1 and data.get('schema_version') == 1, 'unsupported schema')
    require(config.get('repository') == 'kirillgotovtsev/visual-no-slop' and config.get('branch') == 'main', 'unexpected target')
    sources = validate_sources(registry)
    evidence = unique(data.get('evidence'), 'evidence')
    signals = unique(data.get('signals'), 'signal')
    for item in evidence.values():
        require(item.get('source_id') in sources, 'unknown evidence source')
        for key in ['url', 'origin_url']:
            url(item.get(key))
        require(item.get('access') in ['full','partial','blocked','removed','error'], 'bad evidence access')
        for key in ['author_or_publisher','kind','visible_observation','independent_origin_id','work_family','limitations']:
            text(item.get(key), 'evidence.'+key, 2)
        for key in ['published_at','modified_at','original_work_date']:
            require(key in item, 'missing evidence date '+key)
            d = date_or_time(item[key])
            require(d is None or d <= at, 'future evidence date')
        for key in ['first_observed_at','checked_at']:
            require(moment(item.get(key)) <= at, 'future observation')
        require(type(item.get('visual_inspected')) is bool, 'visual_inspected must be boolean')
        inspected = moment(item.get('visual_inspected_at'), True)
        require((inspected is not None) == item['visual_inspected'], 'visual inspection date mismatch')
        if inspected:
            require(inspected <= at and item['access'] in ['full','partial'], 'invalid visual inspection')
            require(item.get('visual_method') in ['view_image','web_image','pdf_screenshot','browser_screenshot','video_playback','frame_sequence'], 'actual visual tool required')
            url(item.get('visual_url'))
            text(item.get('visual_receipt'), 'visual tool receipt')
            if item.get('medium') == 'motion':
                require(item['visual_method'] in ['video_playback','frame_sequence'] and item.get('motion_scope'), 'motion playback or sufficient frame sequence required')
        require(isinstance(item.get('quote'), (str,type(None))), 'quote must be separate text or null')
        require(not item.get('quote') or len(item['quote'].split()) <= 25, 'quote exceeds source limit')
        for key in ['relevance_at','current_relevance_basis']:
            require(key in item, 'missing relevance field')
        relevance = date_or_time(item['relevance_at'])
        if relevance:
            require(relevance <= at, 'future relevance')
            text(item['current_relevance_basis'], 'relevance rationale')
            require(item.get('relevance_kind') in ['dated_primary_work','dated_analysis_of_examples','new_sample_of_continued_use'], 'HTTP check is not a freshness basis')
            require(relevance != moment(item['checked_at']) or item['relevance_kind'] == 'new_sample_of_continued_use', 'checking date cannot silently become publication date')
    active = []
    for signal in signals.values():
        status = signal.get('status')
        require(status in ['active','watchlist','retired'], 'unknown signal status')
        refs = signal.get('evidence_ids')
        require(isinstance(refs,list) and len(refs)==len(set(refs)), 'duplicate/missing evidence references')
        require(all(x in evidence for x in refs), 'missing signal evidence')
        for key in ['name','medium','context','limitations']:
            text(signal.get(key), 'signal.'+key, 2)
        require(isinstance(signal.get('history'),list), 'status history required')
        if status != 'active':
            text(signal.get('status_reason'), 'nonactive reason')
            continue
        active.append(signal)
        examples = [evidence[x] for x in refs if evidence[x]['visual_inspected']]
        require(len({x['independent_origin_id'] for x in examples}) >= 2, 'two independent origins required; reposts do not count')
        require(len({x['work_family'] for x in examples}) >= 2, 'two distinct work/template families required')
        require(len({x['url'] for x in examples}) >= 2, 'duplicate visual examples')
        for key in ['trigger','action','exception','independence_reason','confidence_basis']:
            text(signal.get(key), 'signal.'+key)
        combination = signal.get('visible_combination')
        require(isinstance(combination,list) and len(combination) >= 3, 'specific visible combination required, not a color/font ban')
        require(len({x.get('role') for x in combination}) >= 2, 'describe relationships between visual roles')
        for part in combination:
            text(part.get('role'), 'visual role', 2)
            text(part.get('description'), 'visible property')
        review = signal.get('editorial_review', {})
        require(review.get('decision') == 'admit' and review.get('concrete_visible_combination') is True, 'model must review specificity; schema is not aesthetic review')
        for key in ['rationale','useful_convention','justified_exception','counterevidence']:
            text(review.get(key), 'editorial.'+key)
        require(moment(review.get('reviewed_at')) <= at, 'editorial review timestamp')
        for key in ['first_seen','last_confirmed','expires_at']:
            moment(signal.get(key))
        first, confirmed, expiry = [moment(signal[x]) for x in ['first_seen','last_confirmed','expires_at']]
        require(first <= confirmed <= at, 'signal chronology invalid')
        require(expiry <= confirmed + dt.timedelta(days=config['freshness']['signal_days']), 'signal expiry too long')
        if publication:
            require(expiry > at, 'expired active entry cannot be published')
        relevant = [date_or_time(x['relevance_at']) for x in examples if x['relevance_at']]
        require(len(relevant) >= 2 and all(x >= confirmed-dt.timedelta(days=config['freshness']['context_days']) for x in relevant), 'two recent relevance bases required')
        require(confirmed <= min(relevant), 'last_confirmed cannot be renewed by rereading old evidence')
    revision = data.get('revision', {})
    included_ids=revision.get('included_active_ids', sorted(x['id'] for x in active))
    require(isinstance(included_ids,list) and len(included_ids)==len(set(included_ids)), 'included IDs must be unique')
    require(set(included_ids)<=set(x['id'] for x in active), 'included ID is not active')
    included=[s for s in active if s['id'] in included_ids]
    require(revision.get('status') in ['uninitialized','active'], 'bad revision status')
    if revision['status'] == 'uninitialized':
        require(not active and revision.get('updated_at') is None and revision.get('review_after') is None, 'uninitialized metadata mismatch')
    else:
        updated, review_after = moment(revision.get('updated_at')), moment(revision.get('review_after'))
        require(updated <= at < review_after if publication else updated <= at, 'revision future/expired')
        require(updated < review_after <= updated+dt.timedelta(days=config['freshness']['review_days']), 'review window invalid')
        require(not included or review_after <= min(moment(x['expires_at']) for x in included), 'review_after exceeds signal expiry')
        require(revision.get('reviewed_active_ids') == sorted(included_ids), 'every included entry must be reviewed before revision renewal')
        text(revision.get('coverage_note'), 'coverage note')
    require(len(included) <= config['publication']['max_active_entries'], 'displayed active entries exceed cap; retain other confirmed records in JSON')
    if state is not None:
        require(state.get('schema_version') == 1, 'bad state schema')
        require(isinstance(state.get('completed_runs'),list) and len(state['completed_runs'])==len(set(state['completed_runs'])), 'completed runs must be unique')
        require(isinstance(state.get('pending'),list) and isinstance(state.get('sources'),dict), 'state queues required')
        require(set(state['sources']) <= sources.keys(), 'unknown source state')
        for value in state['sources'].values():
            moment(value.get('covered_through'), True)
            moment(value.get('last_successful_review_at'), True)
    document = render(data)
    require(len(document.encode()) <= config['publication']['max_bytes'], 'consumer exceeds byte cap')
    require(len(document.split()) <= config['publication']['max_words'], 'consumer exceeds word cap')
    return {'sources':len(sources), 'signals':len(signals), 'active':len(active), 'evidence':len(evidence), 'consumer_sha256':sha256(document.encode())}

def render(data):
    revision=data['revision']
    ids=revision.get('included_active_ids')
    active=sorted((x for x in data['signals'] if x['status']=='active' and (ids is None or x['id'] in ids)), key=lambda x:x['id'])
    scalar=lambda x:'null' if x is None else str(x)
    lines=['---','schema_version: 1','status: '+revision['status'],'updated_at: '+scalar(revision['updated_at']),'review_after: '+scalar(revision['review_after']),'source_repository: '+REPO,'signal_count: '+str(len(active)),'---','','# Current visual signals','']
    if revision['status']=='uninitialized':
        lines+=['No researched revision is available. Use the stable skill and historical patterns.','']
        return '\n'.join(lines)
    lines+=['These dated combinations call for examination in the stated context. A color, font or isolated effect establishes neither poor quality nor AI authorship. Preserve a justified brand or genre choice.','',revision['coverage_note'],'']
    if not active:
        lines+=['No candidate met the admission requirements in this review. This is not evidence that visual clichés are absent.','']
    evidence={x['id']:x for x in data['evidence']}
    for s in active:
        lines+=['## '+s['id']+' — '+s['name'],'','**Medium / context:** '+s['medium']+'; '+s['context'],
            '**Visible combination:** '+'; '.join(x['role']+': '+x['description'] for x in s['visible_combination'])+'.',
            '**Trigger:** '+s['trigger'],'**Design action:** '+s['action'],'**Justified use:** '+s['exception'],
            '**Evidence and independence:** '+s['independence_reason']]
        for eid in s['evidence_ids']:
            e=evidence[eid]
            lines+=['- ['+e['id']+']('+e['url']+') — '+e['author_or_publisher']+'; publication '+str(e['published_at'])+'; work '+str(e['original_work_date'])+'; accessed '+e['checked_at']+' ('+e['access']+'); visual '+str(e['visual_inspected_at'])+' via '+str(e.get('visual_method'))+'. '+e['limitations']]
        lines+=['','**Status:** active. **Confidence basis:** '+s['confidence_basis'],
            '**First seen:** '+s['first_seen']+'. **Last confirmed:** '+s['last_confirmed']+'. **Expires:** '+s['expires_at']+'.','']
    return '\n'.join(lines)

def windows(config, state, registry, at=None):
    at=at or now(); out=[]
    for source in registry['sources']:
        checkpoint=state.get('sources',{}).get(source['id'],{}).get('covered_through')
        pending=[x for x in state.get('pending',[]) if x.get('source_id')==source['id'] and x.get('from')]
        lower=min(moment(x['from']) for x in pending) if pending else moment(checkpoint)-dt.timedelta(days=config['freshness']['overlap_days']) if checkpoint else at-dt.timedelta(days=config['freshness']['context_days'])
        upper=min(at,lower+dt.timedelta(days=config['freshness']['catchup_chunk_days'])) if checkpoint and at-moment(checkpoint)>dt.timedelta(days=config['freshness']['catchup_chunk_days']) else at
        if pending:upper=min(at,lower+dt.timedelta(days=config['freshness']['catchup_chunk_days']))
        out.append({'source_id':source['id'],'from':stamp(lower),'through':stamp(upper),'remainder_through':stamp(at) if upper<at else None,'role':source['weekly_role']})
    return out

def checkpoint(state, source_id, interval, receipt):
    """Fetch success alone never advances research coverage."""
    entry=state.setdefault('sources',{}).setdefault(source_id,{})
    entry['last_check']=receipt
    if receipt.get('range_review_complete') is True and receipt.get('access') in ['full','not_modified'] and receipt.get('discovery_complete') is True:
        previous=entry.get('covered_through')
        end=interval['through']
        require(not previous or moment(end)>=moment(previous), 'checkpoint cannot go backwards')
        entry.update(covered_through=end,last_successful_review_at=receipt['checked_at'])
        return True
    return False

def select_revision(previous, candidate, research_ok, visual_capable):
    """Failure never converts the last good instruction into an empty result."""
    return candidate if research_ok and visual_capable else previous

def finish_state(state, run_id, registry, reviewed_through, all_discovery_complete):
    complete = all_discovery_complete and not state['pending'] and all(
        state.get('sources',{}).get(s['id'],{}).get('covered_through') == reviewed_through
        for s in registry['sources'])
    state['last_run_id']=run_id
    state.setdefault('incomplete_runs',[])
    if complete:
        if run_id not in state['completed_runs']:state['completed_runs'].append(run_id)
        state['incomplete_runs']=[r for r in state['incomplete_runs'] if r!=run_id]
        state['last_completed_week']=run_id
    elif run_id not in state['incomplete_runs']:state['incomplete_runs'].append(run_id)
    state['coverage']['full_registry_review_complete']=complete
    return complete

def week_id(at=None):
    local=(at or now()).astimezone(ZoneInfo('Europe/Moscow'))
    year,week,_=local.isocalendar()
    return f'{year}-W{week:02}'

def run_action(state, run_id):
    require(RUN_RE.fullmatch(run_id), 'invalid run_id')
    return 'no-op' if run_id in state['completed_runs'] else 'resume' if run_id in state.get('incomplete_runs',[]) else 'begin'

def safe_path(root, value, run_id=None, setup=False):
    require(isinstance(value,str) and '\\' not in value and '\x00' not in value, 'invalid path')
    p=pathlib.PurePosixPath(value)
    require(not p.is_absolute() and '..' not in p.parts and str(p)==value, 'path traversal or normalization forbidden')
    require((root/value).resolve().is_relative_to(root.resolve()), 'path escaped root')
    for part in [root/value,*(root/value).parents]:
        if part==root.parent: break
        require(not part.is_symlink(), 'symlink forbidden')
    allowed=value in [CONSUMER,str(BASE/'signals.json'),str(BASE/'state.json')]
    if run_id:
        allowed|=value in [str(BASE/'runs'/f'{run_id}.json'),str(BASE/'runs'/f'{run_id}.md')]
    if setup:
        allowed|=value.startswith(str(BASE)+'/')
    require(allowed, 'write outside authorized paths: '+value)
    return root/value

def changed_paths(root, base):
    tracked=subprocess.check_output(['git','-C',str(root),'diff','--name-only','-z',base],text=True).split('\x00')
    new=subprocess.check_output(['git','-C',str(root),'ls-files','--others','--exclude-standard','-z'],text=True).split('\x00')
    return sorted(set(x for x in tracked+new if x))

def make_plan(root, base, run_id, setup=False):
    require(SHA_RE.fullmatch(base), 'expected parent commit SHA required')
    state=read(root/BASE/'state.json')
    if not setup:
        remote_state=json.loads(git(root,'show',base+':'+str(BASE/'state.json')))
        require(run_action(remote_state,run_id)!='no-op', 'completed replay must not publish')
    paths=changed_paths(root,base)
    require(paths, 'no changes to publish')
    entries=[]
    for name in paths:
        path=safe_path(root,name,run_id,setup)
        require(path.is_file(), 'deletions and special files forbidden')
        content=path.read_text()
        require(len(content.encode())<=2*1024*1024, 'file too large')
        require(not LOCAL_PATH_RE.search(content), 'local path in public payload: '+name)
        mode='100755' if (path.stat().st_mode&0o111) else '100644'
        entries.append({'path':name,'mode':mode,'type':'blob','content':content,'sha256':sha256(content.encode()),'git_blob_sha':hashlib.sha1(('blob '+str(len(content.encode()))+'\0').encode()+content.encode()).hexdigest()})
    return {'schema_version':1,'repository':'kirillgotovtsev/visual-no-slop','branch':'main','base_sha':base,'base_tree_sha':git(root,'rev-parse',base+'^{tree}'),'run_id':run_id,'setup':setup,'protected_inputs':protected_hashes(root),'entries':entries}

def publication_decision(remote_head, plan, remote_runs):
    """Call before writing; also use after timeout with a newly fetched remote tree."""
    previous=remote_runs.get(plan['run_id'])
    manifest={e['path']:e['git_blob_sha'] for e in plan['entries']}
    if previous is not None:
        require(previous==manifest, 'run_id exists with different contents; reconcile, do not duplicate')
        return 'already-published'
    require(remote_head==plan['base_sha'], 'main changed; refresh and reconcile (maximum two attempts), no force push')
    return 'publish'

def verify_tree(plan, remote_tree):
    require(remote_tree.get('truncated') is False, 'incomplete remote tree')
    blobs={x['path']:x for x in remote_tree['tree'] if x['type']=='blob'}
    for e in plan['entries']:
        require(e['path'] in blobs and blobs[e['path']]['sha']==e['git_blob_sha'] and blobs[e['path']]['mode']==e['mode'], 'remote readback mismatch: '+e['path'])
    return {'verified_files':len(plan['entries']),'run_id':plan['run_id']}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('action',choices=['validate','render','plan-windows','publication-plan','fingerprint'])
    p.add_argument('--root',type=pathlib.Path,default=ROOT)
    p.add_argument('--base');p.add_argument('--run-id');p.add_argument('--setup',action='store_true');p.add_argument('--output',type=pathlib.Path)
    p.add_argument('--publication',action='store_true')
    a=p.parse_args(); root=a.root.resolve()
    c,s,d,state=[read(root/BASE/name) for name in ['config.json','sources.json','signals.json','state.json']]
    if a.action=='validate':
        result=validate(c,s,d,state,publication=a.publication)
        require((root/CONSUMER).read_text()==render(d), 'rendered Markdown differs from JSON')
    elif a.action=='render':
        validate(c,s,d,state,publication=a.publication)
        (root/CONSUMER).write_text(render(d));result={'rendered':CONSUMER}
    elif a.action=='plan-windows':result={'run_id':week_id(),'action':run_action(state,week_id()),'windows':windows(c,state,s)}
    elif a.action=='fingerprint':result=protected_hashes(root)
    else:
        require(a.base and a.run_id,'--base and --run-id required')
        validate(c,s,d,state,publication=a.publication)
        require((root/CONSUMER).read_text()==render(d),'render mismatch')
        result=make_plan(root,a.base,a.run_id,a.setup)
    if a.output:write(a.output,result);print(json.dumps({'saved':str(a.output),'entries':len(result.get('entries',[]))}))
    else:print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
