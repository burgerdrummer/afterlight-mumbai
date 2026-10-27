"""Small dependency-free raster exports of the existing crescent brand motif."""
from pathlib import Path
import struct,zlib
out=Path(__file__).resolve().parents[1]/'public/icons';out.mkdir(parents=True,exist_ok=True)
def chunk(name,data):return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
for size in [180,192,512]:
    rows=[];bg=(23,62,56);fg=(214,236,182)
    for y in range(size):
        row=bytearray([0])
        for x in range(size):
            coverage=0
            for dy in [.25,.75]:
                for dx in [.25,.75]:
                    u=(x+dx)/size;v=(y+dy)/size
                    moon=(u-.47)**2+(v-.52)**2<.255**2 and (u-.595)**2+(v-.40)**2>.245**2
                    star=(u-.68)**2+(v-.36)**2<.041**2
                    coverage+=int(moon or star)
            row.extend(round(bg[c]+(fg[c]-bg[c])*coverage/4) for c in range(3))
        rows.append(row)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
    (out/f'icon-{size}.png').write_bytes(data)
