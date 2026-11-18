"""Read-only test for an explicitly authorised origin. Requires aiohttp.
500 virtual viewers, eight polls per viewer; stops early if >5% failures.
"""
import asyncio,json,random,sys,time
import aiohttp
async def main():
 origin=sys.argv[1].rstrip('/')
 if not origin.startswith('https://'):raise SystemExit('HTTPS origin required')
 results=[];errors=[];stopped=False
 async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(limit=500,limit_per_host=500),timeout=aiohttp.ClientTimeout(total=20),trust_env=True) as session:
  async with session.get(origin+'/api/live') as r:
   assert r.status==200,f'Preflight HTTP {r.status}'
   data=await r.json();assert len(data['state']['matches'])==15
  start=time.monotonic()
  async def viewer():
   nonlocal stopped
   await asyncio.sleep(random.random()*3);etag=None
   for n in range(8):
    if stopped:return
    begin=time.monotonic();status=0
    try:
     async with session.get(origin+'/api/live',headers={'If-None-Match':etag} if etag else {}) as r:
      status=r.status
      if status==200:
       data=await r.json();assert 'version' in data;etag=r.headers.get('ETag')
      elif status==304:await r.read()
      else:await r.read();errors.append(str(status))
    except Exception as e:errors.append(type(e).__name__)
    results.append((status,(time.monotonic()-begin)*1000))
    if len(results)>=100 and len(errors)/len(results)>.05:stopped=True;return
    if n<7:await asyncio.sleep(max(0,3-(time.monotonic()-begin))+random.random()*.3)
  await asyncio.gather(*(viewer() for _ in range(500)))
  times=sorted(t for _,t in results)
  print(json.dumps({'virtual_viewers':500,'requests':len(results),'seconds':round(time.monotonic()-start,2),'errors':len(errors),'error_types':{s:errors.count(s) for s in set(errors)},'statuses':{str(s):sum(a==s for a,_ in results) for s in set(a for a,_ in results)},'p95_ms':round(times[min(len(times)-1,int(len(times)*.95))],1),'stopped_early':stopped,'scope':'One-location public API polling test, not a full-browser, event Wi-Fi, sustained quota or DDoS test.'},indent=2))
  if errors:sys.exit(1)
asyncio.run(main())
