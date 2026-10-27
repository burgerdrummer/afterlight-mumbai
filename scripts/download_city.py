"""Download/reuse one regional extract, then create the local Mumbai dataset."""
import argparse, subprocess, sys, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
URL='https://download.geofabrik.de/asia/india/western-zone-latest.osm.pbf'
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pbf',type=Path,help='Use an existing regional PBF instead of downloading.')
    parser.add_argument('--refresh',action='store_true',help='Explicitly download a new regional extract.')
    args=parser.parse_args();target=args.pbf or ROOT/'work/import/western-zone-latest.osm.pbf'
    if args.pbf and not target.is_file():raise SystemExit('The specified PBF does not exist.')
    if not args.pbf and (not target.exists() or args.refresh):
        target.parent.mkdir(parents=True,exist_ok=True);temporary=target.with_suffix('.partial')
        request=urllib.request.Request(URL,headers={'User-Agent':'Afterlight-Mumbai-local-import/0.2'})
        with urllib.request.urlopen(request,timeout=90) as response,temporary.open('wb') as output:
            expected=int(response.headers.get('Content-Length',0));count=reported=0
            print('Downloading Western India regional extract (about 211 MB)…',flush=True)
            while chunk:=response.read(1024*1024):
                output.write(chunk);count+=len(chunk)
                if count-reported>=25_000_000:print(f'{count/1e6:.0f} MB downloaded',flush=True);reported=count
            if expected and expected!=count:raise RuntimeError('Download was incomplete; the previous extract was not replaced.')
        temporary.replace(target)
    print('Importing Mumbai City + Suburban districts from',target,flush=True)
    subprocess.run([sys.executable,str(ROOT/'scripts/import_city.py'),'--pbf',str(target)],check=True,cwd=ROOT)
if __name__=='__main__':main()
