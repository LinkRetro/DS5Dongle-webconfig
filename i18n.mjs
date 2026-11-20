/*
 * 多语言字典（首屏与主操作）
 *
 * 覆盖语言：en / zh-CN / zh-TW / ja / ko / de / fr / es / it / pt-BR / ru / pl / tr
 * 选语言优先级：localStorage → navigator.language → en
 * 测试环境（无 navigator.language）回落到 zh-CN，保证既有断言不变。
 */
export const LANGS=[
  ['en','English'],['zh-CN','简体中文'],['zh-TW','繁體中文'],['ja','日本語'],['ko','한국어'],
  ['de','Deutsch'],['fr','Français'],['es','Español'],['it','Italiano'],
  ['pt-BR','Português (BR)'],['ru','Русский'],['pl','Polski'],['tr','Türkçe'],
];

export const S={
  product:{en:'DS5Dongle','zh-CN':'DS5Dongle','zh-TW':'DS5Dongle',ja:'DS5Dongle',ko:'DS5Dongle',de:'DS5Dongle',fr:'DS5Dongle',es:'DS5Dongle',it:'DS5Dongle','pt-BR':'DS5Dongle',ru:'DS5Dongle',pl:'DS5Dongle',tr:'DS5Dongle'},
  subtitle:{
    en:'DualSense · BL616 Edition', 'zh-CN':'DualSense · BL616 版', 'zh-TW':'DualSense · BL616 版',
    ja:'DualSense · BL616 エディション', ko:'DualSense · BL616 에디션', de:'DualSense · BL616 Edition',
    fr:'DualSense · Édition BL616', es:'DualSense · Edición BL616', it:'DualSense · Edizione BL616',
    'pt-BR':'DualSense · Edição BL616', ru:'DualSense · издание BL616', pl:'DualSense · edycja BL616', tr:'DualSense · BL616 Sürümü'},

  nav_feel:{en:'Lighting','zh-CN':'灯光与触觉','zh-TW':'燈光與觸覺',ja:'ライトと触覚',ko:'라이트·햅틱',de:'Lightbar & Haptik',fr:'Barre lumineuse',es:'Barra de luz',it:'Barra luminosa','pt-BR':'Barra de luz',ru:'Подсветка',pl:'Podświetlenie',tr:'Işık ve Haptik'},
  nav_audio:{en:'Audio','zh-CN':'音频','zh-TW':'音訊',ja:'オーディオ',ko:'오디오',de:'Audio',fr:'Audio',es:'Audio',it:'Audio','pt-BR':'Áudio',ru:'Звук',pl:'Dźwięk',tr:'Ses'},
  nav_test:{en:'Diagnostics','zh-CN':'测试中心','zh-TW':'測試中心',ja:'診断',ko:'진단',de:'Diagnose',fr:'Diagnostic',es:'Diagnóstico',it:'Diagnostica','pt-BR':'Diagnóstico',ru:'Диагностика',pl:'Diagnostyka',tr:'Tanılama'},
  nav_flash:{en:'Firmware','zh-CN':'固件更新','zh-TW':'韌體更新',ja:'ファームウェア',ko:'펌웨어',de:'Firmware',fr:'Firmware',es:'Firmware',it:'Firmware','pt-BR':'Firmware',ru:'Прошивка',pl:'Firmware',tr:'Yazılım'},
  nav_touch:{en:'Touchpad','zh-CN':'触摸板与鼠标','zh-TW':'觸控板與滑鼠',ja:'タッチパッド',ko:'터치패드',de:'Touchpad',fr:'Pavé tactile',es:'Panel táctil',it:'Touchpad','pt-BR':'Touchpad',ru:'Тачпад',pl:'Touchpad',tr:'Dokunmatik'},
  nav_remap:{en:'Remapping','zh-CN':'按键映射','zh-TW':'按鍵映射',ja:'ボタン割当',ko:'버튼 재매핑',de:'Tastenbelegung',fr:'Remappage',es:'Remapeo',it:'Rimappatura','pt-BR':'Remapeamento',ru:'Переназначение',pl:'Przypisanie',tr:'Tuş Atama'},
  nav_device:{en:'Dongle','zh-CN':'接收器','zh-TW':'接收器',ja:'ドングル',ko:'동글',de:'Dongle',fr:'Dongle',es:'Dongle',it:'Dongle','pt-BR':'Dongle',ru:'Донгл',pl:'Dongle',tr:'Dongle'},
  nav_about:{en:'About','zh-CN':'关于','zh-TW':'關於',ja:'情報',ko:'정보',de:'Info',fr:'À propos',es:'Acerca de',it:'Informazioni','pt-BR':'Sobre',ru:'О программе',pl:'Informacje',tr:'Hakkında'},

  status_disconnected:{en:'Not connected','zh-CN':'尚未连接接收器','zh-TW':'尚未連接接收器',ja:'未接続',ko:'연결 안 됨',de:'Nicht verbunden',fr:'Non connecté',es:'Sin conexión',it:'Non connesso','pt-BR':'Não conectado',ru:'Не подключено',pl:'Nie połączono',tr:'Bağlı değil'},
  status_connected:{en:'Dongle connected','zh-CN':'接收器已连接','zh-TW':'接收器已連接',ja:'ドングル接続済み',ko:'동글 연결됨',de:'Dongle verbunden',fr:'Dongle connecté',es:'Dongle conectado',it:'Dongle connesso','pt-BR':'Dongle conectado',ru:'Донгл подключён',pl:'Dongle połączony',tr:'Dongle bağlı'},
  ctrl_unknown:{en:'Controller status unknown','zh-CN':'手柄状态未读取','zh-TW':'手把狀態未讀取',ja:'コントローラー状態不明',ko:'컨트롤러 상태 알 수 없음',de:'Controller-Status unbekannt',fr:'État manette inconnu',es:'Estado del mando desconocido',it:'Stato controller sconosciuto','pt-BR':'Status do controle desconhecido',ru:'Статус геймпада неизвестен',pl:'Stan kontrolera nieznany',tr:'Kol durumu bilinmiyor'},

  verdict_ready:{en:'Ready to play','zh-CN':'已就绪，可以开始游戏','zh-TW':'已就緒，可以開始遊戲',ja:'準備完了、プレイ可能',ko:'준비 완료, 플레이 가능',de:'Bereit zum Spielen',fr:'Prêt à jouer',es:'Listo para jugar',it:'Pronto a giocare','pt-BR':'Pronto para jogar',ru:'Готово к игре',pl:'Gotowe do gry',tr:'Oynamaya hazır'},
  verdict_no_device:{en:'Dongle not connected','zh-CN':'接收器尚未连接','zh-TW':'接收器尚未連接',ja:'ドングル未接続',ko:'동글 연결 안 됨',de:'Dongle nicht verbunden',fr:'Dongle non connecté',es:'Dongle sin conectar',it:'Dongle non connesso','pt-BR':'Dongle não conectado',ru:'Донгл не подключён',pl:'Dongle nie podłączony',tr:'Dongle bağlı değil'},
  verdict_no_controller:{en:'Controller not paired','zh-CN':'手柄尚未配对','zh-TW':'手把尚未配對',ja:'コントローラー未接続',ko:'컨트롤러 미연결',de:'Controller nicht verbunden',fr:'Manette non associée',es:'Mando sin emparejar',it:'Controller non associato','pt-BR':'Controle não pareado',ru:'Геймпад не подключён',pl:'Kontroler nie sparowany',tr:'Kol eşleşmedi'},
  verdict_pair_hint:{en:'Hold PS + Create for 3 seconds','zh-CN':'同时按住 PS + Create 3 秒','zh-TW':'同時按住 PS + Create 3 秒',ja:'PS + Create を3秒長押し',ko:'PS + Create 3초간 길게',de:'PS + Create 3 s halten',fr:'Maintenir PS + Create 3 s',es:'Mantén PS + Create 3 s',it:'Tieni premuto PS + Create 3 s','pt-BR':'Segure PS + Create por 3 s',ru:'Удерживайте PS + Create 3 с',pl:'Przytrzymaj PS + Create 3 s',tr:'PS + Create 3 sn basılı tut'},
  verdict_unsupported:{en:'This browser cannot reach HID devices','zh-CN':'此浏览器不支持 WebHID','zh-TW':'此瀏覽器不支援 WebHID',ja:'このブラウザは WebHID 非対応',ko:'이 브라우저는 WebHID 미지원',de:'Dieser Browser unterstützt kein WebHID',fr:'Navigateur sans WebHID',es:'Navegador sin WebHID',it:'Browser senza WebHID','pt-BR':'Navegador sem WebHID',ru:'Браузер без WebHID',pl:'Przeglądarka bez WebHID',tr:'Tarayıcı WebHID desteklemiyor'},
  verdict_checking:{en:'Checking…','zh-CN':'正在检查…','zh-TW':'正在檢查…',ja:'確認中…',ko:'확인 중…',de:'Prüfe…',fr:'Vérification…',es:'Comprobando…',it:'Verifica…','pt-BR':'Verificando…',ru:'Проверка…',pl:'Sprawdzanie…',tr:'Kontrol ediliyor…'},

  qa_rumble:{en:'Test rumble','zh-CN':'试震动','zh-TW':'試震動',ja:'振動テスト',ko:'진동 테스트',de:'Vibration testen',fr:'Tester la vibration',es:'Probar vibración',it:'Prova vibrazione','pt-BR':'Testar vibração',ru:'Проверить вибрацию',pl:'Testuj wibracje',tr:'Titreşimi dene'},
  qa_trigger:{en:'Test triggers','zh-CN':'试扳机','zh-TW':'試扳機',ja:'トリガーテスト',ko:'트리거 테스트',de:'Trigger testen',fr:'Tester les gâchettes',es:'Probar gatillos',it:'Prova grilletti','pt-BR':'Testar gatilhos',ru:'Проверить триггеры',pl:'Testuj spusty',tr:'Tetiği dene'},
  qa_lights:{en:'Test lightbar','zh-CN':'试灯光','zh-TW':'試燈光',ja:'ライトテスト',ko:'라이트 테스트',de:'Lightbar testen',fr:'Tester la barre',es:'Probar la luz',it:'Prova la barra','pt-BR':'Testar a luz',ru:'Проверить подсветку',pl:'Testuj podświetlenie',tr:'Işığı dene'},
  qa_hint:{en:'Temporary test — nothing is saved','zh-CN':'临时测试，不写入设置','zh-TW':'臨時測試，不寫入設定',ja:'一時テスト（設定は保存されません）',ko:'임시 테스트, 설정은 저장되지 않음',de:'Nur ein Test – nichts wird gespeichert',fr:'Test temporaire — rien n’est enregistré',es:'Prueba temporal, no se guarda nada',it:'Prova temporanea, nulla viene salvato','pt-BR':'Teste temporário, nada é salvo',ru:'Временная проверка, настройки не сохраняются',pl:'Test tymczasowy, nic nie jest zapisywane',tr:'Geçici test, hiçbir şey kaydedilmez'},

  connect:{en:'Connect Dongle','zh-CN':'连接接收器','zh-TW':'連接接收器',ja:'ドングルを接続',ko:'동글 연결',de:'Dongle verbinden',fr:'Connecter le dongle',es:'Conectar dongle',it:'Connetti dongle','pt-BR':'Conectar dongle',ru:'Подключить донгл',pl:'Połącz dongle',tr:'Dongle bağla'},
  disconnect:{en:'Disconnect','zh-CN':'断开连接','zh-TW':'中斷連線',ja:'切断',ko:'연결 해제',de:'Trennen',fr:'Déconnecter',es:'Desconectar',it:'Disconnetti','pt-BR':'Desconectar',ru:'Отключить',pl:'Rozłącz',tr:'Bağlantıyı kes'},
  apply:{en:'Apply & Save','zh-CN':'应用并保存','zh-TW':'套用並儲存',ja:'適用して保存',ko:'적용 및 저장',de:'Übernehmen',fr:'Appliquer',es:'Aplicar',it:'Applica','pt-BR':'Aplicar',ru:'Применить',pl:'Zastosuj',tr:'Uygula'},
  revert:{en:'Revert','zh-CN':'撤销更改','zh-TW':'還原變更',ja:'取り消し',ko:'되돌리기',de:'Verwerfen',fr:'Annuler',es:'Revertir',it:'Annulla','pt-BR':'Reverter',ru:'Отменить',pl:'Cofnij',tr:'Geri al'},
  saved:{en:'All changes saved','zh-CN':'没有未应用的更改','zh-TW':'沒有未套用的變更',ja:'保存済み',ko:'저장됨',de:'Alles gespeichert',fr:'Tout est enregistré',es:'Todo guardado',it:'Tutto salvato','pt-BR':'Tudo salvo',ru:'Всё сохранено',pl:'Zapisano',tr:'Kaydedildi'},
  unsaved:{en:'{n} unsaved changes','zh-CN':'有 {n} 项未应用','zh-TW':'有 {n} 項未套用',ja:'未保存 {n} 件',ko:'저장 안 됨 {n}개',de:'{n} nicht gespeichert',fr:'{n} non enregistré(s)',es:'{n} sin guardar',it:'{n} non salvate','pt-BR':'{n} não salvas',ru:'Не сохранено: {n}',pl:'{n} niezapisanych',tr:'{n} kaydedilmedi'},

  left_stick:{en:'Left stick','zh-CN':'左摇杆','zh-TW':'左搖桿',ja:'左スティック',ko:'왼쪽 스틱',de:'Linker Stick',fr:'Stick gauche',es:'Stick izquierdo',it:'Stick sinistro','pt-BR':'Stick esquerdo',ru:'Левый стик',pl:'Lewy drążek',tr:'Sol çubuk'},
  right_stick:{en:'Right stick','zh-CN':'右摇杆','zh-TW':'右搖桿',ja:'右スティック',ko:'오른쪽 스틱',de:'Rechter Stick',fr:'Stick droit',es:'Stick derecho',it:'Stick destro','pt-BR':'Stick direito',ru:'Правый стик',pl:'Prawy drążek',tr:'Sağ çubuk'},
  triggers:{en:'Triggers L / R','zh-CN':'扳机 L / R','zh-TW':'扳機 L / R',ja:'トリガー L / R',ko:'트리거 L / R',de:'Trigger L / R',fr:'Gâchettes L / R',es:'Gatillos L / R',it:'Grilletto L / R','pt-BR':'Gatilhos L / R',ru:'Курки L / R',pl:'Spusty L / R',tr:'Tetik L / R'},
  battery:{en:'Battery','zh-CN':'手柄电量','zh-TW':'手把電量',ja:'バッテリー',ko:'배터리',de:'Akku',fr:'Batterie',es:'Batería',it:'Batteria','pt-BR':'Bateria',ru:'Батарея',pl:'Bateria',tr:'Pil'},
  gyro:{en:'Gyro °/s','zh-CN':'陀螺仪 °/s','zh-TW':'陀螺儀 °/s',ja:'ジャイロ °/s',ko:'자이로 °/s',de:'Gyro °/s',fr:'Gyro °/s',es:'Giroscopio °/s',it:'Giroscopio °/s','pt-BR':'Giroscópio °/s',ru:'Гироскоп °/s',pl:'Żyroskop °/s',tr:'Jiroskop °/s'},
  accel:{en:'Accel g','zh-CN':'加速度 g','zh-TW':'加速度 g',ja:'加速度 g',ko:'가속도 g',de:'Beschl. g',fr:'Accél. g',es:'Acel. g',it:'Accel. g','pt-BR':'Acel. g',ru:'Ускорение g',pl:'Przysp. g',tr:'İvme g'},
  signal:{en:'Signal','zh-CN':'信号','zh-TW':'訊號',ja:'信号',ko:'신호',de:'Signal',fr:'Signal',es:'Señal',it:'Segnale','pt-BR':'Sinal',ru:'Сигнал',pl:'Sygnał',tr:'Sinyal'},
  paired:{en:'paired','zh-CN':'已配对','zh-TW':'已配對',ja:'ペアリング済み',ko:'페어링됨',de:'gekoppelt',fr:'appairés',es:'emparejados',it:'associati','pt-BR':'pareados',ru:'сопряжено',pl:'sparowano',tr:'eşleşti'},

  save_ok:{en:'Saved ✓','zh-CN':'已保存 ✓','zh-TW':'已儲存 ✓',ja:'保存しました ✓',ko:'저장됨 ✓',de:'Gespeichert ✓',fr:'Enregistré ✓',es:'Guardado ✓',it:'Salvato ✓','pt-BR':'Salvo ✓',ru:'Сохранено ✓',pl:'Zapisano ✓',tr:'Kaydedildi ✓'},
  need_connect:{en:'Connect your dongle first','zh-CN':'请先连接接收器','zh-TW':'請先連接接收器',ja:'先にドングルを接続してください',ko:'먼저 동글을 연결하세요',de:'Dongle zuerst verbinden',fr:'Connectez d\u2019abord le dongle',es:'Conecta el dongle primero',it:'Connetti prima il dongle','pt-BR':'Conecte o dongle primeiro',ru:'Сначала подключите донгл',pl:'Najpierw połącz dongle',tr:'Önce dongle bağlayın'},
  disabled_hint:{en:'Connect your dongle to edit settings','zh-CN':'连接接收器后才能修改设置','zh-TW':'連接接收器後才能修改設定',ja:'設定の変更にはドングルの接続が必要です',ko:'설정을 변경하려면 동글을 연결하세요',de:'Zum Bearbeiten Dongle verbinden',fr:'Connectez le dongle pour modifier',es:'Conecta el dongle para editar',it:'Connetti il dongle per modificare','pt-BR':'Conecte o dongle para editar',ru:'Подключите донгл для настройки',pl:'Połącz dongle, aby edytować',tr:'Ayarlar için dongle bağlayın'},
};

export function detectLang(){
  if(typeof __DS5_LANG!=='undefined'&&__DS5_LANG)return __DS5_LANG;   /* 测试/调试可强制语言 */
  try{
    const saved=localStorage.getItem('ds5.lang');
    if(saved&&LANGS.some(([c])=>c===saved))return saved;
  }catch(e){}
  const nav=(typeof navigator!=='undefined'&&navigator.language)||'';
  if(!nav)return 'zh-CN';                       /* 测试环境/无语言信息 */
  const low=nav.toLowerCase();
  if(low.startsWith('zh'))return low.includes('tw')||low.includes('hk')?'zh-TW':'zh-CN';
  const exact=LANGS.find(([c])=>c.toLowerCase()===low);
  if(exact)return exact[0];
  const base=low.split('-')[0];
  const hit=LANGS.find(([c])=>c.toLowerCase().split('-')[0]===base);
  return hit?hit[0]:'en';
}

export function makeT(getLang){
  return (key,params)=>{
    const entry=S[key];
    if(!entry)return key;
    let out=entry[getLang()]||entry.en||key;
    if(params)for(const [k,v] of Object.entries(params))out=out.replace('{'+k+'}',String(v));
    return out;
  };
}
