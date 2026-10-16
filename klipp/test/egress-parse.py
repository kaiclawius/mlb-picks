# Reads strace logs (strace -f -e trace=connect -o file) and lists every network connection that left this computer.
#   python3 test/egress-parse.py klipp.strace stimme.strace
# Set PROXY_PORT if outbound traffic goes through a local proxy, so connections to it count as external.
import os,re,sys,collections
PROXY=int(os.environ.get("PROXY_PORT","0") or 0)
for f in sys.argv[1:]:
    ext=collections.Counter(); loop=collections.Counter(); unix=0
    for line in open(f):
        if "connect(" not in line: continue
        m=re.search(r'sa_family=AF_INET6?, sin6?_port=htons\((\d+)\),.*?(?:inet_addr\("([^"]+)"\)|inet_pton\(AF_INET6, "([^"]+)")',line)
        if not m:
            if "AF_UNIX" in line: unix+=1
            continue
        port=int(m.group(1)); ip=m.group(2) or m.group(3)
        res="ok" if " = 0" in line else ("pending" if "EINPROGRESS" in line else line.strip().split("=")[-1].strip())
        if ip.startswith("127.") or ip in ("::1","0.0.0.0","::") or ip.startswith("::ffff:127."):
            loop[(port if port!=PROXY else f"PROXY:{PROXY}")]+=1
        else: ext[(ip,port,res)]+=1
    print("==",f.split("/")[-1]); print("  loopback ports:",dict(loop)); print("  unix sockets:",unix); print("  EXTERNAL:",dict(ext) if ext else "keine")
