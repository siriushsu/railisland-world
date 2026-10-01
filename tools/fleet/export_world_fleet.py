"""把 tools/fleet 的世界版車款網格輸出到 3D 圖層：rail-3d/assets/blender-map-v1/<id>.bin，並更新同目錄 manifest.json。

用法：python3 tools/fleet/export_world_fleet.py
只改寫本檔 MODELS 列出的網格與車款；manifest 裡其他項目（c381、wenhu）原樣保留。
網格格式與台灣版相同：非索引三角形，每頂點 10 個 float32（位置、法線、sRGB 顏色、光澤），+X 車頭、z=0 軌面、1 單位＝1 公尺。
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit, cars

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../..'))
DEST = os.path.join(REPO, 'rail-3d/assets/blender-map-v1')
MAX_TRIS = 8000   # 與 c381／wenhu 地圖網格同級（24,000 頂點）

MODELS = {
    'r160': dict(
        name='紐約地鐵 R160', family='metro', cab='r160', mid='r160-mid', module='tools/fleet/t_r160.py',
        dimensions=[18.35, 2.98, 3.67],
        sources=[{'label': 'Wikipedia: R160 (New York City Subway car)（尺寸、門數）', 'url': 'https://en.wikipedia.org/wiki/R160_(New_York_City_Subway_car)'},
                 {'label': 'Commons: F Train At Kings Highway.jpg（MTAEnthusiast10，CC BY 4.0；車頭外觀比對）', 'url': 'https://commons.wikimedia.org/wiki/File:F_Train_At_Kings_Highway.jpg'},
                 {'label': 'Commons: R160 NYSlivery2.jpg（LogicalRailfan，CC BY-SA 4.0；側面比對）', 'url': 'https://commons.wikimedia.org/wiki/File:R160_NYSlivery2.jpg'}]),
    'e233': dict(
        name='JR 東日本 E233 系', family='commuter', cab='e233', mid='e233-mid', module='tools/fleet/t_e233.py',
        dimensions=[20.0, 2.95, 4.0165],
        sources=[{'label': 'Wikipedia（日）：JR東日本E233系電車（尺寸、擴幅車體、門數）', 'url': 'https://ja.wikipedia.org/wiki/JR%E6%9D%B1%E6%97%A5%E6%9C%ACE233%E7%B3%BB%E9%9B%BB%E8%BB%8A'},
                 {'label': 'Commons: JRE Series-E233-T4 12cars.jpg（MaedaAkihiko，CC0；車頭與側面比對）', 'url': 'https://commons.wikimedia.org/wiki/File:JRE_Series-E233-T4_12cars.jpg'}]),
    'r62a': dict(
        name='紐約地鐵 R62A／R62', family='metro', cab='r62a', mid='r62a-mid', module='tools/fleet/t_r62a.py',
        dimensions=[15.56, 2.62, 3.62],
        sources=[{'label': 'Wikipedia: R62A (New York City Subway car)（尺寸、門數）', 'url': 'https://en.wikipedia.org/wiki/R62A_(New_York_City_Subway_car)'},
                 {'label': 'Commons: MTA NYC Subway 1 train leaving 125th St.jpg（Mtattrain，CC BY-SA 4.0；車頭與側面比對）', 'url': 'https://commons.wikimedia.org/wiki/File:MTA_NYC_Subway_1_train_leaving_125th_St.jpg'},
                 {'label': 'Commons: R62A Subway Car, 1936, Shuttle, September 5th, 2014.jpg（ARJPHOTOGRAPHY，CC BY-SA 4.0；車頭比對）', 'url': 'https://commons.wikimedia.org/wiki/File:R62A_Subway_Car,_1936,_Shuttle,_September_5th,_2014.jpg'}]),
    'e235': dict(
        name='JR 東日本 E235 系', family='commuter', cab='e235', mid='e235-mid', module='tools/fleet/t_e235.py',
        dimensions=[20.0, 2.95, 3.62],
        sources=[{'label': 'Wikipedia（日）：JR東日本E235系電車（尺寸、門數）', 'url': 'https://ja.wikipedia.org/wiki/JR%E6%9D%B1%E6%97%A5%E6%9C%ACE235%E7%B3%BB%E9%9B%BB%E8%BB%8A'},
                 {'label': 'Commons: Yamanote-Line-E235.jpg、Series-E235-0 9.jpg（MaedaAkihiko，CC BY-SA 4.0；車頭與側面比對）', 'url': 'https://commons.wikimedia.org/wiki/File:Series-E235-0_9.jpg'}]),
    'r142': dict(
        name='紐約地鐵 R142／R142A', family='metro', cab='r142', mid='r142-mid', module='tools/fleet/t_r142.py',
        dimensions=[15.65, 2.68, 3.62],
        sources=[{'label': 'Wikipedia: R142 (New York City Subway car)（尺寸、門數）', 'url': 'https://en.wikipedia.org/wiki/R142_(New_York_City_Subway_car)'},
                 {'label': 'Commons: R142 2 train at East 180th Street.jpg（車頭與側面比對）', 'url': 'https://commons.wikimedia.org/wiki/File:R142_2_train_at_East_180th_Street.jpg'}]),
    'e231': dict(
        name='JR 東日本 E231 系（通勤型）', family='commuter', cab='e231', mid='e231-mid', module='tools/fleet/t_e231.py',
        dimensions=[20.0, 2.95, 4.0515],
        sources=[{'label': 'Wikipedia（日）：JR東日本E231系電車（尺寸、擴幅車體、門數）', 'url': 'https://ja.wikipedia.org/wiki/JR%E6%9D%B1%E6%97%A5%E6%9C%ACE231%E7%B3%BB%E9%9B%BB%E8%BB%8A'},
                 {'label': 'Commons: SeriesE231-0 Sobu-Line.jpg、JRE Series-E231-0 MU10.jpg（MaedaAkihiko；車頭與側面比對）', 'url': 'https://commons.wikimedia.org/wiki/File:SeriesE231-0_Sobu-Line.jpg'}]),
    'r211': dict(
        name='紐約地鐵 R211', family='metro', cab='r211', mid='r211-mid', module='tools/fleet/t_r211.py',
        dimensions=[18.35, 3.05, 3.66],
        sources=[{'label': 'Wikipedia: R211 (New York City Subway car)（尺寸、門數、門寬）', 'url': 'https://en.wikipedia.org/wiki/R211_(New_York_City_Subway_car)'},
                 {'label': 'Commons: R211 A train approaching 80th Street August 2025.jpg（4300streetcar，CC BY 4.0；車頭與側面比對）', 'url': 'https://commons.wikimedia.org/wiki/File:R211_A_train_approaching_80th_Street_August_2025.jpg'},
                 {'label': 'Commons: First R211 Subway Cars Roll Into Service on the A Line.jpg（Metropolitan Transportation Authority，CC BY 2.0；車頭比對）', 'url': 'https://commons.wikimedia.org/wiki/File:First_R211_Subway_Cars_Roll_Into_Service_on_the_A_Line.jpg'}]),
    'tm1000': dict(
        name='東京地鐵 1000 系（銀座線）', family='metro', cab='tm1000', mid='tm1000-mid', module='tools/fleet/t_tm1000.py',
        dimensions=[16.0, 2.55, 3.465],
        sources=[{'label': 'Wikipedia（日）：東京メトロ1000系電車（尺寸、塗裝）', 'url': 'https://ja.wikipedia.org/wiki/%E6%9D%B1%E4%BA%AC%E3%83%A1%E3%83%88%E3%83%AD1000%E7%B3%BB%E9%9B%BB%E8%BB%8A'},
                 {'label': 'Commons: Tokyo-Metro 1000.jpg（Sui-setz，CC BY-SA 3.0；車頭與側面比對）', 'url': 'https://commons.wikimedia.org/wiki/File:Tokyo-Metro_1000.jpg'}]),
}


def main():
    path = os.path.join(DEST, 'manifest.json')
    manifest = json.load(open(path, encoding='utf-8'))
    for mid, spec in MODELS.items():
        source = {'metadata': spec['module'], 'engineeringDimensionsM': spec['dimensions']}
        for mesh_id in (spec['cab'], spec['mid']):
            m, _ = cars.BUILDERS[mesh_id](0)
            if m.ntri > MAX_TRIS:
                sys.exit(f'{mesh_id}: {m.ntri} 三角形超過上限 {MAX_TRIS}')
            info = kit.export(m, os.path.join(DEST, mesh_id + '.bin'))
            del info['triangles']
            manifest['meshes'][mesh_id] = {**info, 'source': source, 'appearance': 'procedural-v1'}
            print(f"{mesh_id:10s} {m.ntri:5d} 三角形  {info['byteLength']:,} bytes")
        manifest['models'][mid] = {
            'id': mid, 'name': spec['name'], 'family': spec['family'], 'articulated': False,
            'parts': [{'mesh': spec['cab'], 'flip': False}, {'mesh': spec['mid'], 'flip': False}, {'mesh': spec['cab'], 'flip': True}],
            'illustrative': True, 'appearance': 'procedural-v1', 'source': source, 'sources': spec['sources'],
        }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))
    print('✓ manifest:', ', '.join(manifest['models']))


if __name__ == '__main__':
    main()
