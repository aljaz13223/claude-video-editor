# Synthesized starter SFX library (whooshes, clicks, sci-fi, UI, risers, hits) — royalty free.
import numpy as np, wave, os
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","sfx"),exist_ok=True)
SR=48000; rng=np.random.default_rng(7)
def save(n,x,g=0.89):
    x=x/ (np.max(np.abs(x))+1e-9)*g; x=np.stack([x,x],1)
    with wave.open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","sfx",f"{n}.wav"),"wb") as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((x*32767).astype(np.int16).tobytes())
def t(d): return np.arange(int(SR*d))/SR
def env(d,a,r,shape=2):
    tt=t(d); e=np.minimum(1,tt/max(a,1e-4))*np.clip((d-tt)/max(r,1e-4),0,1)**shape; return e
def bp(x,f0,f1,q=3):  # swept band-pass (2-pole state-variable)
    n=len(x); f=np.geomspace(f0,f1,n); y=np.zeros(n); lo=bd=0.0
    for i in range(n):
        F=2*np.sin(np.pi*f[i]/SR); hi=x[i]-lo-bd/q; bd+=F*hi; lo+=F*bd; y[i]=bd
    return y
def lp(x,a): 
    y=np.zeros_like(x); s=0
    for i in range(len(x)): s+=a*(x[i]-s); y[i]=s
    return y
def whoosh(n,d,f0,f1,q=2.5,tex=0):
    x=rng.standard_normal(int(SR*d)); 
    if tex: x*= (1+0.6*np.sign(np.sin(2*np.pi*tex*t(d))))
    y=bp(x,f0,f1,q)*np.sin(np.pi*t(d)/d)**1.6; save(n,y,0.8)
whoosh("whoosh_short_01",0.35,500,4000)
whoosh("whoosh_short_02",0.28,3500,700)
whoosh("whoosh_long_01",1.1,250,5000,2)
whoosh("whoosh_long_02",0.9,4500,300,2)
whoosh("whoosh_textured_01",0.6,400,3000,3,tex=38)
def click(n,f,d,noise=0.4,dec=60):
    tt=t(d); y=np.sin(2*np.pi*f*tt)*np.exp(-tt*dec)+noise*rng.standard_normal(len(tt))*np.exp(-tt*dec*3); save(n,y,0.85)
click("click_short",2200,0.05)
click("click_metallic",3800,0.12,0.25,35)
click("click_retro",900,0.08,0.6,50)
def scifi_impact():
    tt=t(0.5); y=np.sin(2*np.pi*(180*np.exp(-tt*6)+40)*tt)*np.exp(-tt*7)+0.3*lp(rng.standard_normal(len(tt)),0.2)*np.exp(-tt*14); save("scifi_impact",y)
def scifi_zap():
    tt=t(0.25); y=np.sign(np.sin(2*np.pi*np.cumsum(np.geomspace(2400,300,len(tt)))/SR))*np.exp(-tt*12)*0.6; save("scifi_shot",lp(y,0.5))
def scifi_blip():
    tt=t(0.18); f=1200+600*np.sign(np.sin(2*np.pi*40*tt)); y=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*14); save("scifi_click",y,0.7)
scifi_impact();scifi_zap();scifi_blip()
def tones(n,fs,step,dec=18):
    out=[]
    for f in fs:
        tt=t(step*1.6); out.append((np.sin(2*np.pi*f*tt)+0.3*np.sin(4*np.pi*f*tt))*np.exp(-tt*dec))
    L=int(SR*step); y=np.zeros(L*len(fs)+len(out[-1]))
    for i,o in enumerate(out): y[i*L:i*L+len(o)]+=o
    save(n,y,0.7)
tones("ui_click",[1400],0.06,45); tones("ui_success",[880,1320],0.09); tones("ui_fail",[420,300],0.12,12)
def riser(n,d,metal=False):
    tt=t(d); f=np.geomspace(60 if not metal else 400, 300 if not metal else 3000,len(tt))
    y=np.sin(2*np.pi*np.cumsum(f)/SR)*(tt/d)**2
    if metal: y+=0.5*np.sin(2*np.pi*np.cumsum(f*1.505)/SR)*(tt/d)**2
    y+=0.4*bp(rng.standard_normal(len(tt)),300,6000,1.5)*(tt/d)**3; y*=np.clip((d-tt)/0.03,0,1); save(n,y,0.8)
riser("riser_bass",2.0); riser("riser_metallic",1.6,True)
def hit(n,heavy):
    tt=t(1.6 if heavy else 0.9); f=(55 if heavy else 70)+ (120 if heavy else 90)*np.exp(-tt*25)
    y=np.tanh(2.5*np.sin(2*np.pi*np.cumsum(f)/SR))*np.exp(-tt*(2.5 if heavy else 4.5))
    y+= (0.6 if heavy else 0.35)*lp(rng.standard_normal(len(tt)),0.15)*np.exp(-tt*18); save(n,y,0.9)
hit("hit_bass",False); hit("hit_heavy",True)
print("ok")
