import numpy as np, cv2
W,H=960,540
d=np.memmap('ref2/frames960.rgb',np.uint8,'r').reshape(-1,H,W,3)
base=cv2.cvtColor(cv2.imread('ref2/base2.jpg'),cv2.COLOR_BGR2RGB).astype(np.float32)/255
warps=np.load('ref2/warps.npy'); loop=np.load('ref2/loop.npy').astype(np.float32); S=8
errs=[];rows=[]
for k in range(0,300,1):
    a=cv2.warpAffine(base,warps[k],(W,H),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    comp=1-(1-a)*(1-loop[k%180]); real=d[S+k].astype(np.float32)/255
    errs.append(np.abs(cv2.GaussianBlur(comp,(0,0),6)-cv2.GaussianBlur(real,(0,0),6)).mean()*255)
    if k in (20,60,100,140,170):
        rows.append(np.hstack([cv2.resize(real,(480,270)),cv2.resize(comp,(480,270))]))
print('mean abs error (0-255, smoothed): %.2f  worst %.2f'%(np.mean(errs),np.max(errs)))
cv2.imwrite('ref2/verify.jpg',cv2.cvtColor((np.vstack(rows)*255).astype(np.uint8),cv2.COLOR_RGB2BGR))
