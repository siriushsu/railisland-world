"""東京地鐵（Tokyo Metro）車型設定，給 jp.py 的參數化產生器用。尺寸取自日文維基百科各車型條目；外觀依 Commons 照片估計。"""

CARS = [
    dict(
        id='tm2000', name='東京地鐵 2000 系（丸之內線）',
        source='ja.wikipedia 東京メトロ2000系（全長 18,000／寬 2,780／高 3,480 mm）；Commons: Tokyo-Metro Series2000-2026.jpg（MaedaAkihiko，CC BY-SA 4.0）',
        pitch=18.0, W=2.78, zb=0.95, roof=3.36, shoulder=3.02, ac_top=3.48, third_rail=True,
        body='#e3262e', low='#b81e25', roof_col='#a9adb1', door_col='#d9232b', win=(1.80, 2.66), win_frame='#3a3d40',
        bands=[(2.84, 2.96, '#c9cdd1')],   # 窗上方銀色正弦波帶（簡化為直帶）
        ac=[(-4.2, 2.6), (4.2, 2.6)],
        front=dict(Ln=0.8, tip_w=0.88, tip_drop=0.08, setback=0.10, face='#e3262e',
                   decals=[('rect', 0.0, 2.68, 2.24, 1.40, 0.38, '#141618', 0.9),          # 黑色「眼睛」面
                           ('rect', -0.72, 2.66, 0.56, 0.90, 0.10, 'GLASS'),
                           ('rect', 0.0, 2.58, 0.60, 1.05, 0.06, 'GLASS'),
                           ('rect', 0.72, 2.66, 0.56, 0.90, 0.10, 'GLASS'),
                           ('rect', 0.0, 3.24, 1.50, 0.18, 0.04, '#2b2d30', 0.7),
                           ('circle', -1.05, 1.74, 0.13, '#1a1c1e'), ('circle', 1.05, 1.74, 0.13, '#1a1c1e'),
                           ('circle', -1.05, 1.74, 0.08, '#f2efe2', 0.9), ('circle', 1.05, 1.74, 0.08, '#f2efe2', 0.9),
                           ('band', 1.40, 1.43, '#d0d3d6')],
                   skirt=('#2f3336', 0.30, 0.70)),
    ),
]
