# writes scripts/data/lao/<name>.txt from stdin lines "N | Lao text" (tab-separated on disk)
import re,sys
name=sys.argv[1]
out=[]
for line in sys.stdin.read().split('\n'):
    m=re.match(r'^\s*(\d+)\s*\|\s?(.*\S)\s*$', line)
    if m: out.append(f'{m.group(1)}\t{m.group(2)}')
open(f'/Users/top/SPP/scripts/data/lao/{name}.txt','w',encoding='utf-8').write('\n'.join(out)+'\n')
print(name, len(out), 'lines')
