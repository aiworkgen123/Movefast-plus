import numpy as np, cv2
W,H=960,540
d=np.memmap('ref2/frames960.rgb',np.uint8,'r').reshape(-1,H,W,3)
base=np.load('ref2/base.npy'); warps=np.load('ref2/warps.npy')
S=8; idx=list(range(S,S+len(warps)))
# neutralise the persistent pink in the sky: true sky chroma = the clean right-hand sky's
sky=base[20:300,820:940].reshape(-1,3).mean(0); rR,rG=sky[0]/sky[2],sky[1]/sky[2]
b2=base.copy()
m=np.zeros((H,W),np.float32); m[:330]=1; m=cv2.GaussianBlur(m,(0,0),15)
b2[...,0]=np.minimum(base[...,0], base[...,2]*rR)*m+base[...,0]*(1-m)
b2[...,1]=np.minimum(base[...,1], base[...,2]*rG)*m+base[...,1]*(1-m)
cv2.imwrite('ref2/base2.jpg',cv2.cvtColor((b2*255).astype(np.uint8),cv2.COLOR_RGB2BGR))
leaks=[]
for k,i in enumerate(idx):
    a=cv2.warpAffine(b2,warps[k],(W,H),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    F=d[i].astype(np.float32)/255
    L=1-(1-F)/np.maximum(1-a,0.04)
    L=np.clip(L,0,1)
    L=cv2.GaussianBlur(L,(0,0),9)        # the leak is a soft light: keep only its low frequencies
    leaks.append(L)
leaks=np.stack(leaks)
np.save('ref2/leaks.npy',leaks.astype(np.float16))
print(leaks.shape, 'mean per channel', leaks.mean((0,1,2)), 'max', leaks.max((0,1,2)))
