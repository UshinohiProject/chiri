var CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("CHANNEL_ACCESS_TOKEN");
var line_endpoint = 'https://api.line.me/v2/bot/message/reply';
// プロファイル取得用のAPIのURL
var line_endpoint_profile = 'https://api.line.me/v2/bot/profile';

//ポストで送られてくるので、ポストデータ取得
//JSONをパースする
function doPost(e) {
  // レスポンスを取得 */
  const response_line = e.postData.getDataAsString();
  // JSON形式に変換する
  const event = JSON.parse(response_line).events[0];
  // イベントへの応答に使用するトークンを取得
  const reply_token = event.replyToken;
  // メッセージを取得
  const user_message = event.message.text;
  // ユーザーIDを取得
  const user_id = event.source.userId;
  // ユーザー名を取得
  var user_display_name = getUserDisplayName(user_id);

  //返信する内容を作成
  var reply_contents; // 配列

  
  /** 郵便番号が指定された場合-1 */
  if (user_message.match( /^\d{3}-\d{4}$/ )) {
    var user_zipcode = user_message.match( /\d{3}-\d{4}/ )[0];
    reply_contents = getConfirmTemplateUserLocation(user_zipcode);
    if (reply_contents['type'] === 'confirm') {
      reply_template(reply_token, reply_contents);
    } else {
      reply_message(reply_token, reply_contents);
    }
  }
  
  /** 郵便番号が指定された場合-2 */
  else if (user_message.match( /^\d{7}$/ )) {
    var user_zipcode = user_message.match( /\d{7}/ )[0];
    reply_contents = getConfirmTemplateUserLocation(user_zipcode);
    if (reply_contents['type'] === 'confirm') {
      reply_template(reply_token, reply_contents);
    } else {
      reply_message(reply_token, reply_contents);
    }
  }
  
  /** 郵便番号以外の数字の羅列が送信された場合 */
  else if (user_message.match( /^\d{1,6}$/ ) || user_message.match( /^\d{8,}$/ )) {
    reply_contents = ['ゴミ出し地域を設定する場合は、有効な郵便番号を7桁の半角数字で入力してください。(ハイフンの使用は可)'];
    reply_message(reply_token, reply_contents);
  }
  
  /** ゴミ出し地域設定で「はい」がおされた場合 */
  else if (user_message.match( /ゴミ出し地域を「.*\d{7}.」で登録する$/ )) {
    var user_zipcode = user_message.match( /\d{7}/ )[0];
    var user_location_street = getUserLocation(user_zipcode)["address3"];
    var user_calender_color = getCalenderColor(reply_token, user_zipcode);
    setUserLocationData(user_id, user_zipcode, user_location_street, user_calender_color);
    reply_contents = getConfirmationMessageDevidedAreaSetting(user_display_name, user_location_street);
    reply_message(reply_token, reply_contents);

  }
  
  /** 青緑複合地域の地域設定 */
  else if (user_message.match( /がゴミ出し地域$/ )) {
    var user_location = user_message.replace(/がゴミ出し地域$/, '');
    var devided_area_info = getDevidedAreaInfo(user_location);
    if (devided_area_info) {
      user_zipcode = devided_area_info['user_zipcode'];
      user_location_street = devided_area_info['user_location_street'];
      user_calender_color = devided_area_info['user_calender_color'];
      setUserLocationData(user_id, user_zipcode, user_location_street, user_calender_color);
      reply_contents = getConfirmationMessageDevidedAreaSetting(user_display_name, user_location_street);
    } else {
      reply_contents = ['ゴミを収集する場所を設定する場合は、有効な郵便番号を7桁の半角数字で入力してください。(ハイフンの使用は可)\n\n特定の日付がなんのゴミの日かを知りたい場合は「YYYY/MM/DD」の形で有効な日付を"/(スラッシュ)"で区切って半角数字で入力してください。\n\n定期配信の設定を変更する場合は、「定期配信」と送信してください。\n\n本アカウントが予期せぬ動作をした場合やエラーが発生した場合は、お手数ですが\ngarbage.info.kagoshima@ushinohi.com\nまでご連絡ください。'];
    }
    reply_message(reply_token, reply_contents);
  }
  
  /** ゴミ出し地域登録の中止 */
  else if (user_message === "登録しない") {
    reply_contents = ["承知しました。ゴミ出し地域登録を中止します。"];
    reply_message(reply_token, reply_contents);
  }
  
  /** ユーザーが郵便番号未登録の場合 */
  else if (!validateUserDataExistence(user_id)) {
    reply_contents = ['ゴミ出し地域の登録がまだお済みでないため、サービスが利用できません。\n\nご利用になるゴミステーションのある地域の郵便番号を7桁の半角数字で入力してください。(ハイフンの使用は可)\n\n本アカウントが予期せぬ動作をした場合やエラーが発生した場合は、お手数ですが\ngarbage.info.kagoshima@ushinohi.com\nまでご連絡ください。'];
    reply_message(reply_token, reply_contents);
  }
  
  /** 定期配信についての設定 */
  else if (user_message === "定期配信" || user_message === "定期配信の設定を変更する") {
    notification_confirmation_contents = getConfirmTemplatePreNotification();
    reply_template(reply_token, notification_confirmation_contents);

  } else if (user_message === "定期配信を希望する") {
    setUserNotificationSetting(user_id, true)
    reply_contents = ['定期配信を「ON」にしました。'];
    reply_message(reply_token, reply_contents);

  } else if (user_message === "定期配信を希望しない") {
    setUserNotificationSetting(user_id, false)
    reply_contents = ['定期配信を「OFF」にしました。'];
    reply_message(reply_token, reply_contents);
  }
  
  /** 日にちが指定された場合 */
  else if (user_message.match( /^(\d{4}\/\d{2}\/\d{2}|\d{4}\/\d{1}\/\d{2}|\d{4}\/\d{2}\/\d{1}|\d{4}\/\d{1}\/\d{1})$/ )) {
    var specified_date = user_message;
    reply_contents = [getSpecifiedDateGarbageInfos(specified_date, user_id)];
    reply_message(reply_token, reply_contents);

  } else if (user_message.match(/今日|きょう|キョウ|本日|ほんじつ|ホンジツ/)) {
    var date_offset = 0;
    sendSpecifiedDateReplyContents(user_id, reply_token, date_offset);

  } else if (user_message.match(/明日|あした|アシタ|あす|アス/)) {
    var date_offset = 1;
    sendSpecifiedDateReplyContents(user_id, reply_token, date_offset);

  } else if (user_message.match(/明明後日|しあさって|シアサッテ/)) {
    var date_offset = 3;
    sendSpecifiedDateReplyContents(user_id, reply_token, date_offset);

  } else if (user_message.match(/明後日|あさって|アサッテ/)) {
    var date_offset = 2;
    sendSpecifiedDateReplyContents(user_id, reply_token, date_offset);

  } else if (user_message.match(/一昨昨日|さき一昨日|さきおととい|サキオトトイ/)) {
    var date_offset = -3;
    sendSpecifiedDateReplyContents(user_id, reply_token, date_offset);

  } else if (user_message.match(/一昨日|おととい|オトトイ/)) {
    var date_offset = -2;
    sendSpecifiedDateReplyContents(user_id, reply_token, date_offset);

  } else if (user_message.match(/昨日|きのう|キノウ/)) {
    var date_offset = -1;
    sendSpecifiedDateReplyContents(user_id, reply_token, date_offset);
  }
  
  /** 一定のメッセージに自動返信 */
  else if (user_message.match(/分別|ぶんべつ|ブンベツ/)) {
    reply_contents = ['鹿児島市の分別についてのお問い合わせはこちらまで↓\n\nサンサンコールかごしま\n099-808-3333'];
    reply_message(reply_token, reply_contents);
  } else if (user_message.match(/剪定|せんてい|センテイ/)) {
    reply_contents = ['鹿児島市の剪定枝戸別収集受付についてのお問い合わせはこちらまで↓\n\n099-268-8888'];
    reply_message(reply_token, reply_contents);
  } else if (user_message.match(/粗大|そだい|ソダイ/)) {
    reply_contents = ['鹿児島市の粗大ごみ収集受付についてのお問い合わせはこちらまで↓\n\n099-8135-380'];
    reply_message(reply_token, reply_contents);
  }
  
  /** 住所変更についての設定 */
  else if (user_message === "住所変更") {
    var message_content = 'お引越しおめでとうございます！ご新居の郵便番号を入力してください。(ハイフンの使用は可)'
    return sendMessage(user_id, message_content);
  }
  
  /** その他全ての受信メッセージへのデフォルト返信 */
  else {
    reply_contents = ['■ゴミを収集する場所を設定する場合は、有効な郵便番号を7桁の半角数字で入力してください。(ハイフンの使用は可)\n\n■特定の日付がなんのゴミの日かを知りたい場合は「YYYY/MM/DD」の形で有効な日付を"/(スラッシュ)"で区切って半角数字で入力してください。\n\n■定期配信の設定を変更する場合は、「定期配信」と送信してください。\n\n■本アカウントが予期せぬ動作をした場合やエラーが発生した場合は、お手数ですが\ngarbage.info.kagoshima@ushinohi.com\nまでご連絡ください。'];
    reply_message(reply_token, reply_contents);

  }
}

/** DBにユーザーデータがあるかの検証 */
function validateUserDataExistence(user_id) {
  const sheet = SpreadsheetApp.getActiveSheet();
  var validation = findRow(sheet,user_id,1)[0];
  return validation;
}

/** 青緑混合地区のカレンダー情報を返す */
function getDevidedAreaInfo(user_location) {
  if (!user_location) { // debug
    var user_message = '鴨池新町１〜２５番の地域がゴミ出し地域';
    var user_location = user_message.replace(/がゴミ出し地域$/, '');
  }

  const devidedAreasInfos = [
    {user_location_street: '上荒田町５０〜５７番の地域',
    user_zipcode: '8900055',
    user_calender_color: 'blue'},

    {user_location_street: '上荒田町５０〜５７番以外の地域',
    user_zipcode: '8900055',
    user_calender_color: 'green'},

    {user_location_street: '宇宿８丁目１８番、もしくは２０番の地域',
    user_zipcode: '8900073',
    user_calender_color: 'blue'},

    {user_location_street: '宇宿１〜９丁目のうち、８丁目１８番、もしくは２０番を除く地域',
    user_zipcode: '8900073',
    user_calender_color: 'green'},

    {user_location_street: '小野町西之谷の地域',
    user_zipcode: '8900022',
    user_calender_color: 'blue'},

    {user_location_street: '小野町のうち、西之谷以外の地域',
    user_zipcode: '8900022',
    user_calender_color: 'green'},

    {user_location_street: '上谷口町上伊集院団地',
    user_zipcode: '8992703',
    user_calender_color: 'blue'},

    {user_location_street: '上谷口町のうち、上伊集院団地以外の地域',
    user_zipcode: '8992703',
    user_calender_color: 'green'},

    {user_location_street: '鴨池新町１〜２５番の地域',
    user_zipcode: '8900064',
    user_calender_color: 'green'},

    {user_location_street: '鴨池新町２６〜４０番の地域',
    user_zipcode: '8900064',
    user_calender_color: 'blue'},

    {user_location_street: '清水町１〜２４番の地域',
    user_zipcode: '8920802',
    user_calender_color: 'green'},

    {user_location_street: '清水町２５〜３２番の地域',
    user_zipcode: '8920802',
    user_calender_color: 'blue'},

    {user_location_street: '下荒田１丁目、もしくは４丁目の地域',
    user_zipcode: '8900056',
    user_calender_color: 'blue'},

    {user_location_street: '下荒田２丁目、もしくは３丁目の地域',
    user_zipcode: '8900056',
    user_calender_color: 'green'},

    {user_location_street: '下伊敷２丁目２９、３１、３３、もしくは３４番の地域',
    user_zipcode: '8900005',
    user_calender_color: 'blue'},

    {user_location_street: '下伊敷１〜３丁目のうち、２丁目２９、３１、３３、もしくは３４番を除く地域',
    user_zipcode: '8900005',
    user_calender_color: 'green'},

    {user_location_street: '下田町七窪の地域',
    user_zipcode: '8920873',
    user_calender_color: 'green'},

    {user_location_street: '下田町のうち、七窪以外の地域',
    user_zipcode: '8920873',
    user_calender_color: 'blue'},

    {user_location_street: '鷹師１丁目',
    user_zipcode: '8900043',
    user_calender_color: 'green'},

    {user_location_street: '鷹師２丁目',
    user_zipcode: '8900043',
    user_calender_color: 'blue'},

    {user_location_street: '谷山中央１丁目、もしくは２丁目',
    user_zipcode: '8910141',
    user_calender_color: 'green'},

    {user_location_street: '谷山中央３〜８丁目',
    user_zipcode: '8910141',
    user_calender_color: 'blue'},

    {user_location_street: '西谷山３丁目３５〜３９番の地域',
    user_zipcode: '8910117',
    user_calender_color: 'green'},

    {user_location_street: '西谷山１〜４丁目のうち、３丁目３５〜３９番を除く地域',
    user_zipcode: '8910117',
    user_calender_color: 'blue'},

    {user_location_street: '東坂元４丁目５１、５２、５４番の地域',
    user_zipcode: '8920861',
    user_calender_color: 'blue'},

    {user_location_street: '東坂元１〜４丁目のうち、４丁目５１、５２、もしくは５４番を除く地域',
    user_zipcode: '8920861',
    user_calender_color: 'green'},

    {user_location_street: '平川町火の河原の地域',
    user_zipcode: '8910133',
    user_calender_color: 'green'},

    {user_location_street: '平川町のうち、火の河原以外の地域',
    user_zipcode: '8910133',
    user_calender_color: 'blue'},

    {user_location_street: '広木２丁目３５〜３９番の地域',
    user_zipcode: '8900037',
    user_calender_color: 'green'},

    {user_location_street: '広木１〜３丁目のうち、２丁目３５〜３９番を除く地域',
    user_zipcode: '8900037',
    user_calender_color: 'blue'},

    {user_location_street: '皆与志町河頭の地域',
    user_zipcode: '8911206',
    user_calender_color: 'green'},

    {user_location_street: '皆与志町のうち、河頭以外の地域',
    user_zipcode: '8911206',
    user_calender_color: 'blue'},

    {user_location_street: '紫原１丁目１番１号',
    user_zipcode: '8900082',
    user_calender_color: 'blue'},

    {user_location_street: '紫原１〜７丁目のうち、１丁目１番１号以外の地域',
    user_zipcode: '8900082',
    user_calender_color: 'green'},

    {user_location_street: '和田３丁目',
    user_zipcode: '8910143',
    user_calender_color: 'green'},

    {user_location_street: '和田１、２丁目',
    user_zipcode: '8910143',
    user_calender_color: 'blue'}
  ]

  var devidedAreasInfo = {};
  devidedAreasInfos.some(function(element) {
    if (element.user_location_street === user_location) {
      devidedAreasInfo = element;
      return true;
    }
  });
  return devidedAreasInfo;

}

/** 郵便番号から住所を確認するためのテンプレート作成 */
function getConfirmTemplateUserLocation(user_zipcode) {
  var user_location = getUserLocation(user_zipcode);

  if (user_location === null || user_location["address3"] === '') {
    var reply_contents = ["郵便番号は有効な7桁の数字で入力してください。(ハイフンの使用は可)"];
  } else if (user_location["address1"] + user_location["address2"] === "鹿児島県鹿児島市") {
    user_location_street = user_location["address3"] + '(' + user_location["zipcode"] + ')'
    var reply_contents = {
      'type': 'confirm',
      'text': 'あなたのゴミ出し地域を「' + user_location_street + '」で登録しますか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': 'ゴミ出し地域を「' + user_location_street + '」で登録する'},
        {'type': 'message', 'label': 'いいえ', 'text': '登録しない'}
      ]
    };
  } else {
    var reply_contents = ["大変申し訳ありませんが、「" + user_location["address1"] + user_location["address2"] + user_location["address3"] + "」は本サービス対象地域外です。こちらのアカウントは「鹿児島県鹿児島市」のゴミ収集情報にのみ対応しております。"];
  }
  return reply_contents;
}

/** 郵便番号から住所を取得 */
function getUserLocation(user_zipcode) {
  var url = 'https://zipcloud.ibsnet.co.jp/api/search?zipcode=' + user_zipcode;

  var data = httpGet(url);

  var user_location = ""
  if (data["results"]) {
    user_location = data["results"][0];
  } else {
    user_location = data["results"];
  }
  return user_location;
}

/** ゴミの日前日の定期配信の有無を確認するためのテンプレート作成 */
function getConfirmTemplatePreNotification() {
  var reply_contents = {
    'type': 'confirm',
    'text': 'ゴミの日の前日21時と当日朝7時に、何のゴミの日かの定期配信を受け取りますか？',
    'actions': [
      {'type': 'message', 'label': 'はい', 'text': '定期配信を希望する'},
      {'type': 'message', 'label': 'いいえ', 'text': '定期配信を希望しない'}
    ]
  };
  return reply_contents;
}

/** 外部APIからの取得 */ 
function httpGet(theUrl) {
  var resp = UrlFetchApp.fetch(theUrl);
  var data = JSON.parse(resp.getContentText());
  return data;
}

/** 責任者にテスト配信 */ 
function testCreateMessageToAdmin(message_content) {
  var admin_user_id = PropertiesService.getScriptProperties().getProperty("ADMIN_USER_ID");
  if (!message_content) {
    // var message_content = '空メッセージを送信します。'
    var message_content = '【プラ】\n\n2022年5月27日(金)は「プラスチック容器類」の日です。'
  }
  return sendMessage(admin_user_id, message_content);
}

/** 定期配信 */
function sendDailyMessage() {
  setTrigger();

  var date_infos = getDateInfos();
  notifyGarbageInofs(date_infos);
}

/** 定期配信をONにしている人に何のゴミの日かを配信 */
function notifyGarbageInofs(date_infos) {
  var date = date_infos[0];
  var day = date_infos[1];
  var today_or_tomorrow = date_infos[2];
  
  //　登録者全員のデータを二次元Arrayで取得
  const sheet = SpreadsheetApp.getActiveSheet();
  var user_infos = sheet.getDataRange().getValues();
  user_infos.splice(0,1);

  // 定期配信希望者のuser_idを取得してゴミ情報を配信
  user_infos.forEach(function(element) {
    if (element[4]) {
      user_id = element[0];
      calender_color = element[3];
      if (day !== 0 && day !== 6) {
        var garbage_infos = getGarbageInfos(calender_color, date, day, today_or_tomorrow);
      } else {
        var garbage_infos = today_or_tomorrow + 'はゴミの収集は実施されません。';
      }
      
      sendMessage(user_id, garbage_infos);
    }
  });
}

/** 当日、もしくは翌日のごみ収集情報を返す */
function getDateInfos() {
  const days = {
    0: '日',
    1: '月',
    2: '火',
    3: '水',
    4: '木',
    5: '金',
    6: '土'
  };

  var timezoneoffset = -9
  var today = new Date(Date.now() - (timezoneoffset * 60 - new Date().getTimezoneOffset()) * 60000); // JSTを取得

  var time_now = today.getHours();

  // 朝の配信のときは当日、夜の配信の時は翌日の情報を配信
  if (time_now < 12) {
    var month = today.getMonth() + 1;
    var date = today.getDate();
    var day = today.getDay();
    var day_ja = getDayJapanese(day);
    var today_or_tomorrow = '本日' + month + '月' + date + '日(' + day_ja + ')';
  } else {
    var tomorrow = new Date(today.setDate(today.getDate() + 1)); // 24時間後の日時に変換
    var month = tomorrow.getMonth() + 1;
    var date = tomorrow.getDate();
    var day = tomorrow.getDay();
    var day_ja = getDayJapanese(day);
    var today_or_tomorrow = '明日' + month + '月' + date + '日(' + day_ja + ')';
  }
  var date_infos = [date, day, today_or_tomorrow];
  return date_infos;
}

/** 任意の日付のごみ収集情報を返信 */
function sendSpecifiedDateReplyContents(user_id, reply_token, date_offset) {
    var timezoneoffset = -9
    var today = new Date(Date.now() - (timezoneoffset * 60 - new Date().getTimezoneOffset()) * 60000); // JSTを取得;
    var specified_date = new Date(today.setDate(today.getDate() + date_offset)); // 指定された日時に変換
    var reply_contents = [getSpecifiedDateGarbageInfos(specified_date, user_id)];
    reply_message(reply_token, reply_contents);
}

/** 日時オブジェクトから曜日を日本語にして返す */
function getDayJapanese(day) {
  const days = {
    0: '日',
    1: '月',
    2: '火',
    3: '水',
    4: '木',
    5: '金',
    6: '土'
  };
  var day_ja = days[day];
  return day_ja;
}

/** ごみ収集情報を取得 <ごみ収集曜日情報最終更新日: 2021/03/12/Fri> */
function getGarbageInfos(calender_color, date, day, today_or_tomorrow) {

  // 土日の場合
  if (day === 0 || day === 6) {
    var garbage_infos = today_or_tomorrow + 'はゴミの収集は実施されません。';
  }
  
  // 平日の場合
  // 緑のカレンダーの場合
  else if (calender_color === 'green') {
    if (day === 1 || day === 4) { // 月曜or木曜
      var garbage_infos = '【もやせるごみ】\n\n' + today_or_tomorrow + 'は「もやせるごみ」の日です。';
    } else if (day === 5) { // 金曜
      var garbage_infos = '【プラ】\n\n' + today_or_tomorrow + 'は「プラスチック容器類」の日です。';
    } else if (day === 2) { // 火曜
      if (Math.floor(date / 7) + 1 === 1 || Math.floor(date / 7) + 1 === 3) { // 第１火曜or第３火曜
        var garbage_infos = '【紙類/衣類】\n\n' + today_or_tomorrow + 'は「紙類」「衣類」の日です。以下のものが該当します。\n\n【紙類】\n・新聞\n・段ボール\n・雑がみ\n・紙パック\n\n【衣類】\n・衣類';
      } else if (Math.floor(date / 7) + 1 === 2) { // 第２火曜
        var garbage_infos = '【紙類/衣類/電球など】\n\n' + today_or_tomorrow + 'は「紙類」「電球など」の日です。以下のものが該当します。\n\n【紙類】\n・新聞\n・段ボール\n・雑がみ\n・紙パック\n・衣類\n\n【電球など】\n・電球\n・蛍光灯\n・乾電池\n・スプレー缶類\n\n※「紙類」と「電球など」は別に収集するため、分けてゴミ捨て場に出してください。';
      } else { // 第４以降の火曜
        var garbage_infos = '【紙類】\n\n' + today_or_tomorrow + 'は「紙類」の日です。以下のものが該当します。\n\n【紙類】\n・新聞\n・段ボール\n・雑がみ\n・紙パック';
      }
    } else if (day === 3) { // 水曜
      if (Math.floor(date / 7) + 1 === 2) { // 第２水曜
        var garbage_infos = '【金属類】\n\n' + today_or_tomorrow + 'は「金属類」の日です。以下のものが該当します。\n\n【金属類】\n・鍋\n・電化製品など';
      } else if (Math.floor(date / 7) + 1 === 4) { // 第４水曜
        var garbage_infos = '【陶器/ガラス類等】\n\n' + today_or_tomorrow + 'は「陶器」「ガラス類」などの「もやせないごみ」の日です。';
      } else { // 第１or第３or第５水曜
        var garbage_infos = '【缶/びん/ペットボトル】\n\n' + today_or_tomorrow + 'は「缶」「びん」「ペットボトル」の日です。以下のものが該当します。\n\n※「缶」は潰さずに「びん」と同じゴミ袋に入れて出してください。缶がびんのクッションになり、割れにくくなります。\n※びんなどのふたで、金属製のものは金属類、プラスチック類のものはプラスチック容器類で出してください。';
      }
    }
  }
  
  // 青のカレンダーの場合
  else {
    if (day === 2 || day === 5) { // 火曜or金曜
      var garbage_infos = '【もやせるごみ】\n\n' + today_or_tomorrow + 'は「もやせるごみ」の日です。';
    } else if (day === 4) { // 木曜
      var garbage_infos = '【プラ】\n\n' + today_or_tomorrow + 'は「プラスチック容器類」の日です。';
    } else if (day === 1) { // 月曜
      if (Math.floor(date / 7) + 1 === 1 || Math.floor(date / 7) + 1 === 3) { // 第１火曜or第３火曜
        var garbage_infos = '【紙類/衣類】\n\n' + today_or_tomorrow + 'は「紙類」「衣類」の日です。以下のものが該当します。\n\n【紙類】\n・新聞\n・段ボール\n・雑がみ\n・紙パック\n\n【衣類】\n・衣類';
      } else if (Math.floor(date / 7) + 1 === 2) { // 第２火曜
        var garbage_infos = '【紙類/衣類/電球など】\n\n' + today_or_tomorrow + 'は「紙類」「電球など」の日です。以下のものが該当します。\n\n【紙類】\n・新聞\n・段ボール\n・雑がみ\n・紙パック\n・衣類\n\n【電球など】\n・電球\n・蛍光灯\n・乾電池\n・スプレー缶類\n\n※「紙類」と「電球など」は別に収集するため、分けてゴミ捨て場に出してください。';
      } else { // 第４以降の火曜
        var garbage_infos = '【紙類】\n\n' + today_or_tomorrow + 'は「紙類」の日です。以下のものが該当します。\n\n【紙類】\n・新聞\n・段ボール\n・雑がみ\n・紙パック';
      }
    } else if (day === 3) { // 水曜
      if (Math.floor(date / 7) + 1 === 1) { // 第１水曜
        var garbage_infos = '【金属類】\n\n' + today_or_tomorrow + 'は「金属類」の日です。以下のものが該当します。\n\n【金属類】\n・鍋\n・電化製品など';
      } else if (Math.floor(date / 7) + 1 === 3) { // 第３水曜
        var garbage_infos = '【陶器/ガラス類等】\n\n' + today_or_tomorrow + 'は「陶器」「ガラス類」などの「もやせないごみ」の日です。';
      } else { // 第２or第４or第５水曜
        var garbage_infos = '【缶/びん/ペットボトル】\n\n' + today_or_tomorrow + 'は「缶」「びん」「ペットボトル」の日です。以下のものが該当します。\n\n※「缶」は潰さずに「びん」と同じゴミ袋に入れて出してください。缶がびんのクッションになり、割れにくくなります。\n※びんなどのふたで、金属製のものは金属類、プラスチック類のものはプラスチック容器類で出してください。';
      }
    }
  }
  return garbage_infos;
}

/** 指定された日のゴミ情報を取得*/
function getSpecifiedDateGarbageInfos(specified_date, user_id) {
  if (!specified_date) {
    var specified_date = new Date('2021/12/15'); // debug
  }

  var error_message = '正しい日付を「YYYY/MM/DD」の形で入力してください。';
  try {
    var specified_date = new Date(specified_date);
  }
  catch (e) {
    return error_message;
  }
  
  // 日付要素を分解
  var year = specified_date.getFullYear();
  var month = specified_date.getMonth() + 1;
  var date = specified_date.getDate();
  var day = specified_date.getDay();
  var day_ja = getDayJapanese(day);

  if (!date) {
    return error_message;
  }

  var date_infos_ja = year + '年' + month + '月' + date + '日(' + day_ja + ')'

  const sheet = SpreadsheetApp.getActiveSheet();
  var row_num = findRow(sheet,user_id,1)[0];
  var user_calender_color = sheet.getRange(row_num, 4).getValue();

  var garbage_infos = getGarbageInfos(user_calender_color, date, day, date_infos_ja);
  return garbage_infos;
}

/** メッセージを返信 */
function reply_message(reply_token, message) {
  var postData = {
    "replyToken": reply_token,
    "messages": [{
      "type" : "text",
      "text" : "" + message[0]
    }]
  };
  var options = {
    "method": "post",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN
    },
    "payload": JSON.stringify(postData)
  };
  UrlFetchApp.fetch(line_endpoint, options);
}

/** テンプレートを返信 */
function reply_template(reply_token, template_content) {
  var postData = {
    "replyToken": reply_token,
    "messages": [{
      "type" : "template",
      "altText" : "郵便番号確認テンプレートメッセージ",
      "template" : template_content 
    }]
  };
  var options = {
    "method": "post",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN
    },
    "payload": JSON.stringify(postData)
  };
  UrlFetchApp.fetch(line_endpoint, options);
}

/** メッセージを配信 */
function sendMessage(user_id, message_content) {
  var url = "https://api.line.me/v2/bot/message/push";
  var headers = {
    "Content-Type" : "application/json; charset=UTF-8",
    'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
  };

  var postData = {
    "to" : user_id,
    "messages" : [
      {
        'type':'text',
        'text': message_content,
      }
    ]
  };

  var options = {
    "method" : "post",
    "headers" : headers,
    "payload" : JSON.stringify(postData)
  };

  return UrlFetchApp.fetch(url, options);
}

/** ユーザーのアカウント名を取得 */
function getUserDisplayName(user_id) {
  if (!user_id) {
    var user_id = '';
  }
  var res = UrlFetchApp.fetch(line_endpoint_profile + '/' + user_id, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'get',
  });
  var user_display_name = JSON.parse(res).displayName;
  console.log(user_display_name)
  return user_display_name;
}

/** ユーザーのゴミ出し地域、カレンダーカラー、定期配信設定などを登録・更新 */
function setUserLocationData(user_id, user_zipcode, user_address, user_calender_color) {
  const sheet = SpreadsheetApp.getActiveSheet();
  row_num = findRow(sheet,user_id,1);
  if (row_num[0]) {
    data = [[user_zipcode, user_address, user_calender_color]];
    sheet.getRange(row_num[0], 2, 1, 3).setValues(data);
  } else {
    var default_bool_notification = true;
    data = [[user_id, user_zipcode, user_address, user_calender_color, default_bool_notification]];
    sheet.getRange(row_num[1]+1, 1, 1, 5).setValues(data);
  }
}

/** 定期配信設定を更新 */
function setUserNotificationSetting(user_id, bool_notification) {
  const sheet = SpreadsheetApp.getActiveSheet();
  row_num = findRow(sheet,user_id,1);
  sheet.getRange(row_num[0], 5).setValue(bool_notification);
}

/** 指定された要素がスプレッドシートに登録されているかどうか、そして登録データ数を返す */
function findRow(sheet,val,col){

  var dat = sheet.getDataRange().getValues(); //受け取ったシートのデータを二次元配列に取得
  var dat_length = dat.length;
  for(var i=1;i<dat_length;i++){
    if(dat[i][col-1] === val){
      return [i+1, dat_length];
    }
  }
  return [0, dat_length];
}

/** ゴミ出し地域のカレンダーカラーを返す */
function getCalenderColor(reply_token, user_zipcode) {
  if(!checkDevidedArea(user_zipcode)){
    var calender_clors = {
      'green': [
        '8900054', '8911545', '8920806', '8900008', '8900007', '8911203',
        '8900003', '8992701', '8920822', '8920801', '8911205', '8910112', '8900021',
        '8900022', '8920804', '8920851', '8920818', '8900063', '8911103', '8910203',
        '8910206', '8910204', '8910107', '8920836', '8920828', '8920837', '8900038',
        '8911108', '8911105', '8910101', '8992531', '8911231', '8910150', '8900075',
        '8900004', '8910106', '8920835', '8992707', '8900013', '8920813', '8920853',
        '8900072', '8900016', '8920838', '8920823', '8920823', '8920843', '8900014',
        '8900015', '8920872', '8920805', '8900045', '8900031', '8900012', '8900053',
        '8910108', '8910105', '8920807', '8920845', '8910115', '8900047', '8900044',
        '8920854', '8920827', '8900023', '8910122', '8920863', '8900046', '8911106',
        '8900083', '8911101', '8900068', '8920842', '8911102', '8910151', '8900086',
        '8920855', '8992702', '8920831', '8910102', '8900069', '8900085', '8920815',
        '8920819', '8920816', '8910104', '8920844', '8911104', '8900006']
    };
    if (calender_clors['green'].includes(user_zipcode)) {
      calender_clor = 'green';
    } else {
      calender_clor = 'blue';
    }
  } else {
    sendSpecificQuestionDevidedArea(reply_token, user_zipcode);
  }
  return calender_clor;
}

/** 郵便番号が青緑混合地区かどうかを検証 */
function checkDevidedArea(user_zipcode) {
  var devided_areas = [
    '8900055', '8900073', '8900074', '8911222', '8900022', '8992703',
    '8900064', '8920802', '8900056', '8900005', '8920873', '8900043', '8910141',
    '8910117', '8920861', '8910133', '8900037', '8911206', '8900082', '8910143'];
  return devided_areas.includes(user_zipcode);
}

/** ゴミ出し地域を設定したことの確認メッセージを返す */
function getConfirmationMessageDevidedAreaSetting(user_display_name, user_location_street) {
  var confirmation_messages = [user_display_name + "さんのゴミ出し地域を「" + user_location_street + "」に設定しました。\n\n設定いただきありがとうございました！\n\n「定期配信」と送信すると、ゴミの日の定期配信についての設定を変更できます。\n\n「定期配信」とは設定いただいたゴミ出し地域が「なんのゴミの日なのか」を前日の夜21時と当日の朝7時にお知らせするサービスです。\n\n「明日はなんのゴミの日？」や「粗大ゴミを捨てたい」など、いろいろ話しかけてみてください！\n\n追加して欲しい機能や改善して欲しい点がありましたら、\ngarbage.info.kagoshima@ushinohi.com\nまでメールいただけたら幸いです！"];
  return confirmation_messages;
}

/** 青緑混合地区において青緑を特定するテンプレートを送信 */
function sendSpecificQuestionDevidedArea(reply_token, user_zipcode) {
  if (user_zipcode === '8900055') { // 上荒田町
    var specific_question_contents = {
      'type': 'confirm',
      'text': '上荒田町５０〜５７番の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '上荒田町５０〜５７番の地域がゴミ出し地域'},
        {'type': 'message', 'label': 'いいえ', 'text': '上荒田町５０〜５７番以外の地域がゴミ出し地域'} // green
      ]
    };
  } else if (user_zipcode === '8900073' || user_zipcode === '8900074') { // 宇宿
    var specific_question_contents = {
      'type': 'confirm',
      'text': '宇宿８丁目１８番、もしくは２０番の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '宇宿８丁目１８番、もしくは２０番の地域がゴミ出し地域'},
        {'type': 'message', 'label': 'いいえ', 'text': '宇宿１〜９丁目のうち、８丁目１８番、もしくは２０番を除く地域がゴミ出し地域'} // green
      ]
    };
  } else if (user_zipcode === '8911222' || user_zipcode === '8900022') { // 小野町
    var specific_question_contents = {
      'type': 'confirm',
      'text': '小野町西之谷ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '小野町西之谷の地域がゴミ出し地域'},
        {'type': 'message', 'label': 'いいえ', 'text': '小野町のうち、西之谷以外の地域がゴミ出し地域'} // green
      ]
    };
  } else if (user_zipcode === '8992703') { // 上谷口町
    var specific_question_contents = {
      'type': 'confirm',
      'text': '上谷口町上伊集院団地ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '上谷口町上伊集院団地がゴミ出し地域'},
        {'type': 'message', 'label': 'いいえ', 'text': '上谷口町のうち、上伊集院団地以外の地域がゴミ出し地域'} // green
      ]
    };
  } else if (user_zipcode === '8900064') { // 鴨池新町
    var specific_question_contents = {
      'type': 'confirm',
      'text': '鴨池新町１〜２５番の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '鴨池新町１〜２５番の地域がゴミ出し地域'}, // green
        {'type': 'message', 'label': 'いいえ', 'text': '鴨池新町２６〜４０番の地域がゴミ出し地域'}
      ]
    };
  } else if (user_zipcode === '8920802') { // 清水町
    var specific_question_contents = {
      'type': 'confirm',
      'text': '清水町１〜２４番の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '清水町１〜２４番の地域がゴミ出し地域'}, // green
        {'type': 'message', 'label': 'いいえ', 'text': '清水町２５〜３２番の地域がゴミ出し地域'}
      ]
    };
  } else if (user_zipcode === '8900056') { // 下荒田
    var specific_question_contents = {
      'type': 'confirm',
      'text': '下荒田１丁目、もしくは４丁目の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '下荒田１丁目、もしくは４丁目の地域がゴミ出し地域'},
        {'type': 'message', 'label': 'いいえ', 'text': '下荒田２丁目、もしくは３丁目の地域がゴミ出し地域'} //green
      ]
    };
  } else if (user_zipcode === '8900005') { // 下伊敷
    var specific_question_contents = {
      'type': 'confirm',
      'text': '下伊敷２丁目２９、３１、３３、もしくは３４番の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '下伊敷２丁目２９、３１、３３、もしくは３４番の地域がゴミ出し地域'},
        {'type': 'message', 'label': 'いいえ', 'text': '下伊敷１〜３丁目のうち、２丁目２９、３１、３３、もしくは３４番を除く地域がゴミ出し地域'} // green
      ]
    };
  } else if (user_zipcode === '8920873') { // 下田町
    var specific_question_contents = {
      'type': 'confirm',
      'text': '下田町七窪の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '下田町七窪の地域がゴミ出し地域'}, // green
        {'type': 'message', 'label': 'いいえ', 'text': '下田町のうち、七窪以外の地域がゴミ出し地域'}
      ]
    };
  } else if (user_zipcode === '8900043') { // 鷹師
    var specific_question_contents = {
      'type': 'confirm',
      'text': '鷹師１丁目ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '鷹師１丁目がゴミ出し地域'}, // green
        {'type': 'message', 'label': 'いいえ', 'text': '鷹師２丁目がゴミ出し地域'}
      ]
    };
  } else if (user_zipcode === '8910141') { // 谷山中央
    var specific_question_contents = {
      'type': 'confirm',
      'text': '谷山中央１丁目、もしくは２丁目ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '谷山中央１丁目、もしくは２丁目がゴミ出し地域'}, // green
        {'type': 'message', 'label': 'いいえ', 'text': '谷山中央３〜８丁目がゴミ出し地域'}
      ]
    };
  } else if (user_zipcode === '8910117') { // 西谷山
    var specific_question_contents = {
      'type': 'confirm',
      'text': '西谷山３丁目３５〜３９番の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '西谷山３丁目３５〜３９番の地域がゴミ出し地域'}, // green
        {'type': 'message', 'label': 'いいえ', 'text': '西谷山１〜４丁目のうち、３丁目３５〜３９番を除く地域がゴミ出し地域'}
      ]
    };
  } else if (user_zipcode === '8920861') { // 東坂元
    var specific_question_contents = {
      'type': 'confirm',
      'text': '東坂元４丁目５１、５２、５４番の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '東坂元４丁目５１、５２、５４番の地域がゴミ出し地域'},
        {'type': 'message', 'label': 'いいえ', 'text': '東坂元１〜４丁目のうち、４丁目５１、５２、もしくは５４番を除く地域がゴミ出し地域'} // green
      ]
    };
  } else if (user_zipcode === '8910133') { // 平川町
    var specific_question_contents = {
      'type': 'confirm',
      'text': '平川町火の河原の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '平川町火の河原の地域がゴミ出し地域'}, // green
        {'type': 'message', 'label': 'いいえ', 'text': '平川町のうち、火の河原以外の地域がゴミ出し地域'}
      ]
    };
  } else if (user_zipcode === '8900037') { // 広木
    var specific_question_contents = {
      'type': 'confirm',
      'text': '広木２丁目３５〜３９番の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '広木２丁目３５〜３９番の地域がゴミ出し地域'}, // green
        {'type': 'message', 'label': 'いいえ', 'text': '広木１〜３丁目のうち、２丁目３５〜３９番を除く地域がゴミ出し地域'}
      ]
    };
  } else if (user_zipcode === '8911206') { // 皆与志町
    var specific_question_contents = {
      'type': 'confirm',
      'text': '皆与志町河頭の地域ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '皆与志町河頭の地域がゴミ出し地域'}, // green
        {'type': 'message', 'label': 'いいえ', 'text': '皆与志町のうち、河頭以外の地域がゴミ出し地域'}
      ]
    };
  } else if (user_zipcode === '8900082') { // 紫原
    var specific_question_contents = {
      'type': 'confirm',
      'text': '紫原１丁目１番１号ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '紫原１丁目１番１号がゴミ出し地域'},
        {'type': 'message', 'label': 'いいえ', 'text': '紫原１〜７丁目のうち、１丁目１番１号以外の地域がゴミ出し地域'} // green
      ]
    };
  } else if (user_zipcode === '8910143') { // 和田
    var specific_question_contents = {
      'type': 'confirm',
      'text': '和田３丁目ですか？',
      'actions': [
        {'type': 'message', 'label': 'はい', 'text': '和田３丁目がゴミ出し地域'}, // green
        {'type': 'message', 'label': 'いいえ', 'text': '和田１、２丁目がゴミ出し地域'}
      ]
    };
  }

  reply_template(reply_token, specific_question_contents);
}

/** 定期配信時にトリガーを再設定 */
function setTrigger() {
  var timezoneoffset = -9;
  var setTime = new Date(Date.now() - (timezoneoffset * 60 - new Date().getTimezoneOffset()) * 60000); // JSTを取得

  if (setTime.getHours() < 12) {
    setTime.setHours(21);
    setTime.setMinutes(00); 
  } else {
    setTime.setDate(setTime.getDate() + 1)
    setTime.setHours(7);
    setTime.setMinutes(00); 
  }
  ScriptApp.newTrigger('sendDailyMessage').timeBased().at(setTime).create();
}

function myFunction() {
  var timezoneoffset = -9;
  var specified_date = new Date(Date.now() - (timezoneoffset * 60 - new Date().getTimezoneOffset()) * 60000); // JSTを取得
  try {
    var hour = specified_date.getHours();
    var minute = specified_date.getMinutes();
    var time_now = hour + ':' + minute;
    console.log(time_now);
  }
  catch (e) {
    console.log('正しい日付を「YYYY/MM/DD」の形で入力してください。');
  }
}


















