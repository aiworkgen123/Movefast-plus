import numpy as np, cv2, sys
W,H=960,540
d=np.memmap('ref2/frames960.rgb',np.uint8,'r').reshape(-1,H,W,3)
S=8; N=len(d)
end=min(N, S+360)
idx=list(range(S,end))
warm=np.load('ref2/warm.npy')
clean=S+int(np.argmin(warm[S:S+180]))
print('clean frame',clean,'t=%.2f'%((clean-S)/60))
ref=cv2.cvtColor(np.ascontiguousarray(d[clean]),cv2.COLOR_RGB2GRAY).astype(np.float32)/255
hp=lambda g: g-cv2.GaussianBlur(g,(0,0),8)
R=hp(ref)
warps={}
crit=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,200,1e-6)
for i in idx:
    g=cv2.cvtColor(np.ascontiguousarray(d[i]),cv2.COLOR_RGB2GRAY).astype(np.float32)/255
    M=np.eye(2,3,dtype=np.float32)
    try:
        _,M=cv2.findTransformECC(R,hp(g),M,cv2.MOTION_AFFINE,crit,None,5)
    except cv2.error:
        pass
    warps[i]=M     # maps frame-i coords -> ref coords? (ECC: template=R, input=g; warp g into R with M)
# aligned frames into ref geometry
al=np.stack([cv2.warpAffine(np.ascontiguousarray(d[i]),warps[i],(W,H),flags=cv2.INTER_LINEAR|cv2.WARP_INVERSE_MAP,borderMode=cv2.BORDER_REPLICATE) for i in idx]).astype(np.float32)/255
base=np.percentile(al,8,axis=0)
cv2.imwrite('ref2/base.jpg',cv2.cvtColor((base*255).astype(np.uint8),cv2.COLOR_RGB2BGR))
np.save('ref2/base.npy',base.astype(np.float32))
np.save('ref2/warps.npy',np.stack([warps[i] for i in idx]))
s=[warps[i][0,0] for i in idx];print('scale range',min(s),max(s))
