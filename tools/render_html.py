# Render a paused GSAP timeline (window.TL) to MP4 frame by frame.
# Usage: W=1080 H=1920 python3 render_html.py page.html out.mp4 18   (or stills: ... out 18 1.0,2.5)
import sys, subprocess, asyncio
from playwright.async_api import async_playwright
html, out, dur = sys.argv[1], sys.argv[2], float(sys.argv[3]); fps=30
stills=[float(x) for x in sys.argv[4].split(',')] if len(sys.argv)>4 else None
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome' if False else None)
        pg=await b.new_page(viewport={'width':int(__import__('os').environ.get('W',1920)),'height':int(__import__('os').environ.get('H',1080))})
        await pg.goto('file://'+html); await pg.wait_for_timeout(800); await pg.evaluate('document.fonts.ready.then(()=>1)')
        if stills:
            for t in stills:
                await pg.evaluate(f'TL.seek({t},false);0'); await pg.screenshot(path=f'{out}_{t:05.2f}.png')
            await b.close(); return
        ff=subprocess.Popen(['ffmpeg','-v','error','-y','-f','image2pipe','-framerate',str(fps),'-i','-','-c:v','libx264','-preset','medium','-crf','16','-pix_fmt','yuv420p',out],stdin=subprocess.PIPE)
        n=int(dur*fps)
        for i in range(n):
            await pg.evaluate(f'TL.seek({i/fps},false);0')
            ff.stdin.write(await pg.screenshot(type='jpeg',quality=95))
        ff.stdin.close(); ff.wait(); await b.close()
asyncio.run(main())
