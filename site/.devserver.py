import http.server, socketserver, os, re, sys
ROOT=os.path.dirname(os.path.abspath(__file__))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=ROOT,**k)
    def end_headers(self):
        self.send_header('Accept-Ranges','bytes')
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def send_head(self):
        rng=self.headers.get('Range')
        path=self.translate_path(self.path)
        if not rng or not os.path.isfile(path):
            return super().send_head()
        m=re.match(r'bytes=(\d*)-(\d*)',rng.strip())
        if not m: return super().send_head()
        size=os.path.getsize(path)
        s,e=m.group(1),m.group(2)
        if s=='':
            length=int(e); start=max(0,size-length); end=size-1
        else:
            start=int(s); end=int(e) if e else size-1
        end=min(end,size-1)
        if start>end:
            self.send_error(416); return None
        f=open(path,'rb'); f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type',self.guess_type(path))
        self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length',str(end-start+1))
        self.end_headers()
        self._range=(start,end)
        return f
    def copyfile(self,src,dst):
        if hasattr(self,'_range'):
            start,end=self._range; remain=end-start+1
            while remain>0:
                chunk=src.read(min(64*1024,remain))
                if not chunk: break
                dst.write(chunk); remain-=len(chunk)
            del self._range
        else:
            super().copyfile(src,dst)
class S(socketserver.ThreadingTCPServer): allow_reuse_address=True; daemon_threads=True
S(('127.0.0.1',int(sys.argv[1])),H).serve_forever()
