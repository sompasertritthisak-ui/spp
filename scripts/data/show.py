import json,sys
for name in sys.argv[1:]:
    d=json.load(open(f'/Users/top/SPP/scripts/data/pending/{name}.json'))
    print(f'=== {name} ({len(d)})')
    for i,k in enumerate(d,1): print(f'{i}\t{k}')
