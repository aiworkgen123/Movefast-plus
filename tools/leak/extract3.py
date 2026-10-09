import numpy as np, cv2
W,H=960,540
d=np.memmap('ref2/frames960.rgb',np.uint8,'r').reshape(-1,H,W,3)
base=cv2.cvtColor(cv2.imread('ref2/base2.jpg'),cv2.COLOR_BGR2RGB).astype(np.float32)/255
warps=np.load('ref2/warps.npy'); S=8
g=cv2.cvtColor(base,cv2.COLOR_RGB2GRAY)
grad=cv2.GaussianBlur(np.abs(cv2.Laplacian(g,cv2.CV_32F,ksize=3)),(0,0),4)
ship=np.zeros((H,W),np.float32); ship[90:380,180:890]=1
wb=np.clip(1-g,0,1)**2*np.exp(-grad*25)*np.clip(1-cv2.GaussianBlur(ship,(0,0),10)*1.4,0,1)
out=[]
for k in range(len(warps)):
    i=S+k
    a=cv2.warpAffine(base,warps[k],(W,H),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    w=cv2.warpAffine(wb,warps[k],(W,H),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    F=d[i].astype(np.float32)/255
    L=np.clip(1-(1-F)/np.maximum(1-a,0.05),0,1)
    def nc(sig):
        num=np.stack([cv2.GaussianBlur(L[...,c]*w,(0,0),sig) for c in range(3)],-1)
        den=cv2.GaussianBlur(w,(0,0),sig)[...,None]
        return num/(den+1e-6), den
    a1,d1=nc(30); a2,d2=nc(110)
    t=np.clip(d1/(0.35*np.median(d1)+1e-6),0,1)          # where the near weights run out, the wide fill takes over
    sm=cv2.GaussianBlur(a1*t+a2*(1-t),(0,0),16)          # no seam where the fill hands over
    sm[...,1]=np.minimum(sm[...,1],sm[...,0]*0.62); sm[...,2]=np.minimum(sm[...,2],sm[...,0]*0.55)
    sm=np.clip(sm-np.percentile(sm.reshape(-1,3),3,axis=0),0,1)
    out.append(sm)
L=np.stack(out); n=len(L)-180
loop=L[:180].copy(); loop[:n]=(L[:n]+L[180:180+n])/2
np.save('ref2/loop.npy',loop.astype(np.float16))
print('agreement', np.corrcoef(L[:n].ravel()[::97],L[180:180+n].ravel()[::97])[0,1], 'max',loop.max((0,1,2)))
tiles=[cv2.resize((loop[k]*255).astype(np.uint8),(320,180)) for k in range(0,180,15)]
cv2.imwrite('ref2/loop_tiles.jpg',cv2.cvtColor(np.vstack([np.hstack(tiles[r*4:(r+1)*4]) for r in range(3)]),cv2.COLOR_RGB2BGR))
