"""Render the three source ERDs in DATABASE.md as readable PNG/PDF tables.

Requires Pillow and Windows Malgun Gothic fonts. Run from any directory.
Relationships and fields come from DATABASE.md; positions are presentation only.
"""
from pathlib import Path
import re
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'DATABASE.md'
FONT = 'C:/Windows/Fonts/malgun.ttf'
BOLD = 'C:/Windows/Fonts/malgunbd.ttf'
W, H, BW, HEADER, ROW = 2520, 1740, 460, 92, 43
NAMES = {
    'AUTH_USERS': '사용자 계정', 'trips': '여행', 'trip_members': '여행 멤버',
    'trip_invites': '여행 초대', 'trip_regions': '여행 지역', 'trip_stops': '일정 장소',
    'accommodation_stays': '숙소', 'trip_ledgers': '여행 예산',
    'ledger_people': '정산 참여자', 'expenses': '지출', 'expense_splits': '지출 분담',
    'settlement_receipts': '수령 기록', 'ai_usage': 'AI 사용량',
    'ai_quota_overrides': 'AI 예외 한도',
}
LAYOUTS = [
    {'AUTH_USERS': (70, 200), 'trips': (700, 200), 'trip_regions': (1330, 200),
     'trip_stops': (1960, 200), 'trip_invites': (70, 1070),
     'trip_members': (700, 1070), 'accommodation_stays': (1710, 1070)},
    {'trips': (70, 200), 'AUTH_USERS': (70, 680), 'trip_ledgers': (700, 200),
     'ledger_people': (700, 1080), 'expenses': (1330, 200),
     'expense_splits': (1960, 200), 'settlement_receipts': (1710, 1080)},
    {'AUTH_USERS': (180, 460), 'ai_usage': (1080, 240),
     'ai_quota_overrides': (1080, 980)},
]
TITLES = ['여행 · 일정 · 함께 편집', '가계부 · 지출 · 분담 · 수령', '계정별 AI 사용량']
COLORS = ['#245f94', '#267366', '#705a9b']
NOTES = [
    '지역 삭제: 장소·숙소는 유지하고 지역 연결만 해제  /  여행 삭제: 종속 데이터 함께 삭제',
    '정산 참여자 ≠ 로그인 계정  /  결제자·분담자·송수신자는 trip_id와 함께 복합 FK로 참조',
    '사용량 PK: 사용자 + 날짜 + 기능  /  예외 한도 PK: 사용자 + 기능  /  여행과 직접 연결 없음',
]

def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)

def parse(block):
    entities = {}
    for name, body in re.findall(r'^    (\w+) \{\n(.*?)^    \}', block, re.M | re.S):
        fields = []
        for line in body.strip().splitlines():
            bits = line.strip().split('"')[0].split()
            fields.append((bits[1], bits[0], ' '.join(bits[2:])))
        entities[name] = fields
    edges = re.findall(r'^    (\w+) (\|\||o\|)--(o\{|o\|) (\w+) : "([^"]+)"', block, re.M)
    return entities, edges

def card(draw, name, fields, pos, color):
    x, y = pos
    bottom = y + HEADER + ROW * len(fields)
    draw.rectangle((x+5, y+5, x+BW+5, bottom+5), fill='#e1e7ee')
    draw.rectangle((x, y, x+BW, bottom), fill='white', outline='#a8b7c7', width=2)
    draw.rectangle((x, y, x+BW, y+HEADER), fill=color)
    draw.text((x+18, y+10), NAMES[name], font=font(29, True), fill='white')
    draw.text((x+18, y+52), 'auth.users' if name == 'AUTH_USERS' else name, font=font(21), fill='#eaf1fa')
    for i, (col, typ, keys) in enumerate(fields):
        yy = y + HEADER + ROW*i
        if 'PK' in keys:
            draw.rectangle((x+2, yy, x+BW-2, yy+ROW), fill='#eef4fa')
        draw.line((x, yy+ROW, x+BW, yy+ROW), fill='#dde4ed')
        draw.text((x+12, yy+10), keys.replace(', ', '/'), font=font(16, True), fill=color)
        draw.text((x+90, yy+7), col, font=font(22), fill='#203044')
        tw = draw.textlength(typ, font=font(17))
        draw.text((x+BW-12-tw, yy+12), typ, font=font(17), fill='#64758b')

def marker(draw, point, toward, many=False, optional=False):
    x,y=point; dx,dy=toward
    px,py=-dy,dx
    def p(a,b=0): return (x+dx*a+px*b,y+dy*a+py*b)
    if many:
        draw.line([p(0,-10),p(18),p(0,10)],fill='#657e99',width=3)
        draw.line([p(0),p(18)],fill='#657e99',width=3)
    else:
        draw.line([p(10,-10),p(10,10)],fill='#657e99',width=3)
    if optional:
        cx,cy=p(29)
        draw.ellipse((cx-6,cy-6,cx+6,cy+6),fill='#f8fafc',outline='#657e99',width=2)
    else:
        draw.line([p(22,-10),p(22,10)],fill='#657e99',width=3)

def render(index, entities, edges):
    image = Image.new('RGB', (W,H), '#f8fafc'); d=ImageDraw.Draw(image)
    d.text((65,42), f'0{index+1}  {TITLES[index]}', font=font(44,True), fill='#203044')
    d.text((68,108), 'TRAVEL COMPANION  /  논리 ERD · 주요 컬럼  /  SQL 소스 기준 2026-09-30',font=font(23),fill='#65758a')
    layout=LAYOUTS[index]
    for n,(a,ca,cb,b,label) in enumerate(edges):
        ax,ay=layout[a]; bx,by=layout[b]
        ah=HEADER+ROW*len(entities[a]); bh=HEADER+ROW*len(entities[b])
        # Route through the open space between rows for vertical relationships.
        if by > ay+ah+100:
            start=(ax+BW*(0.28+(n%4)*0.16),ay+ah)
            end=(bx+BW*(0.28+(n%3)*0.20),by)
            lane=790+(n%5)*48 if index!=2 else 840
            lane=max(start[1]+60,min(lane,by-55))
            pts=[start,(start[0],lane),(end[0],lane),end]
            u=(0,1);v=(0,-1); labelpos=((start[0]+end[0])/2,lane-19)
        elif by < ay-100:
            start=(ax+BW,ay+HEADER+35+(n%2)*45); end=(bx+BW*0.65,by+bh)
            lane=970+(n%3)*30
            pts=[start,(ax+BW+60,start[1]),(ax+BW+60,lane),(end[0],lane),end]
            u=(1,0);v=(0,1);labelpos=((ax+BW+end[0])/2,lane-19)
        else:
            start=(ax+BW,ay+HEADER+25+(n%3)*35)
            end=(bx,by+HEADER+25+(n%3)*35)
            if bx>ax+BW and any(ax<x<bx and abs(y-ay)<300 for key,(x,y) in layout.items() if key not in (a,b)):
                lane=680+(n%3)*45
                pts=[start,(start[0]+45,start[1]),(start[0]+45,lane),(end[0]-45,lane),(end[0]-45,end[1]),end]
                labelpos=((start[0]+end[0])/2,lane-19)
            else:
                mid=(start[0]+end[0])/2
                pts=[start,(mid,start[1]),(mid,end[1]),end]
                labelpos=(mid,(start[1]+end[1])/2-28)
            u=(1,0);v=(-1,0)
        if index == 1 and a == 'trips' and b == 'ledger_people':
            start=(530,325); end=(825,1080)
            pts=[start,(600,325),(600,870),(825,870),end]
            u=(1,0);v=(0,-1);labelpos=(710,850)
        if index == 1 and a == 'trips' and b == 'settlement_receipts':
            start=(400,335);end=(1840,1080)
            pts=[start,(400,540),(560,540),(560,930),(1840,930),end]
            u=(0,1);v=(0,-1);labelpos=(1200,910)
        if index == 2 and b == 'ai_usage':
            start=(640,590);end=(1080,410)
            pts=[start,(850,590),(850,410),end]
            u=(1,0);v=(-1,0);labelpos=(850,370)
        d.line(pts,fill='#7990a8',width=3)
        marker(d,start,u,optional=ca=='o|')
        marker(d,end,v,many=cb=='o{',optional=True)
        caption=f'{label}  [{"0..1" if ca=="o|" else "1"} : {"N" if cb=="o{" else "0..1"}]'
        if abs(by-ay)<100 and 0 < bx-ax-BW < 250:
            caption=f'{"0..1" if ca=="o|" else "1"} : {"N" if cb=="o{" else "0..1"}'
        tw=d.textlength(caption,font=font(18))
        lx,ly=labelpos
        d.rectangle((lx-tw/2-7,ly-3,lx+tw/2+7,ly+25),fill='#f8fafc')
        d.text((lx-tw/2,ly),caption,font=font(18),fill='#405b77')
    for name,fields in entities.items(): card(d,name,fields,layout[name],COLORS[index])
    d.line((65,1580,W-65,1580),fill='#d7e1eb',width=2)
    d.text((65,1600),'PK 기본 키   FK 외래 키   UK 고유 키   ○ 선택 관계   갈퀴 여러 건 (N = 0개 이상)',font=font(24),fill='#324b64')
    d.text((65,1647),NOTES[index],font=font(22),fill='#64758b')
    image.save(HERE/f'database-erd-{index+1}.png')
    return image

if __name__ == '__main__':
    blocks=re.findall(r'```mermaid\n(.*?)```',SOURCE.read_text(encoding='utf-8'),re.S)
    assert len(blocks)==3
    images=[render(i,*parse(block)) for i,block in enumerate(blocks)]
    images[0].save(HERE/'database-erd.pdf',save_all=True,append_images=images[1:],resolution=150)
    print('Generated 3 ERD PNG images and 3-page PDF from DATABASE.md')
