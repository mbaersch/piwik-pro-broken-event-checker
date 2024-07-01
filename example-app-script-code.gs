/*FYI:     the setup block below is defined in an additional file. 
           Do so yourself or add your values here. Leave "webhook_url" or 
           "email_address" blank if you do not want to send messages / mails 

  TRIGGER: If you want to trigger this function regularly, adjust the 
           lookback_window parameter in "getBrokenEvents" and schedule  
           "checkBrokenEvents" to run the check, store results and 
           send mails
*/

if (typeof(setup) == "undefined") {
  let setup = {
     "client_id": "xxxxx",
     "client_secret": "xxxxxxxxxxxxxxxx",
     "webhook_url": "https://hooks.slack.com/services/xxxx/yyyy/zzzz",
     "site_id": "enter-your-site-id-here",
     "site_url": "https://your-instance.piwik.pro",
     "email_address": "yourmail@example.com"
  };
} 

let search_debug_type = 17, //8 = Goal, 4 = Search, 17 = broken event, 18 = excluded event
   session_limit = 5;

/*****************************************************************************************/

function checkBrokenEvents() {
  var res = getBrokenEvents();
  Logger.log("Done, Result:\n"+res);
  //store in spreadsheet
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  addReportLine(sheet, res);

  //check result and send mail
  if ((res != "no events") && setup["email_address"] && (setup["email_address"] != "")) {
    Logger.log("Sending result as email to "+setup["email_address"]);
    MailApp.sendEmail({
      to: setup["email_address"],
      subject: "Message from Piwik PRO Event Checker",
      htmlBody: res.replace(/\n/g, "<br>")
    });  
  }  
}

/*****************************************************************************************/

function getAuthToken() {
  let auth_body = {"grant_type": "client_credentials", "client_id": setup["client_id"], "client_secret": setup["client_secret"]};
  var response = UrlFetchApp.fetch(
        setup["site_url"] + '/auth/token', 
        {'method' : 'post', 
         'muteHttpExceptions': false, 
         'contentType': 'application/json', 
         'payload' : JSON.stringify(auth_body)
        });
  return JSON.parse(response.getContentText())["access_token"];
}


function addReportLine(sheet, inf) {
  let lastRow = sheet.getLastRow(), dt = (new Date()).toISOString().split('.')[0].replace("T", " ");
  dataRange = sheet.getRange(lastRow+1, 1, 1, 2);
  dataRange.setValues([[dt, inf]]); 
  SpreadsheetApp.flush();
  Logger.log("results for "+dt+" stored in spreadsheet");
}


function getBrokenEvents() {
  let token = getAuthToken();
  let res = "";
  try {
   //set a lookback window to a max of 300 or 60 (or 70) if run every hour...
    let url = setup["site_url"] + '/api/tracker/v1/debugger?app_id=' + 
              setup["site_id"] + '&lookup_window=70&limit=' + session_limit.toString() + 
              '&event_type=' + search_debug_type.toString();
    let options = {'method' : 'get', 'muteHttpExceptions': false, 'headers': {'Authorization': 'Bearer ' + token}};
    let repResponse = UrlFetchApp.fetch(url, options);

    let cnt = repResponse.getContentText();
    if (cnt == "") res = "no events"; 
    else {
      let sessions = cnt.split("\n");
      sessions.forEach(session => {
        let json_session = JSON.parse(session),
            rep_start = json_session["server_time"],
            rep_end = json_session["updated_at"],
            events = json_session["events"];      
        let hook_sent = false;
        events.forEach(event => {
          //Logger.log(event["event_type"][1] + ", ID: " + event["event_id"]);
          if (event["event_type"][0] === search_debug_type) {
            let err = (event["error_message"]) ? event["error_message"] : "no errors";
            res += event["event_type"][1] +  ", ID: " + event["event_id"] + ", Message: " + err + "\n";
            url = setup["site_url"] + '/api/tracker/v1/log?app_id=' + setup["site_id"] + '&event_ids=' + event["event_id"] +
                                  '&server_time_min=' + rep_start + '&server_time_max=' + rep_end;
            //this is not working here and I don´t know why :( getting random 500 or 400 responses. That should explain this odd code construction 
            let loginfo = "Error fetching log";
            if (false) try {
              let log_response = UrlFetchApp.fetch(url, options);
              let loginfo = log_response.getContentText();
              res += "LOG:\n----\n" + loginfo + "\n";
            } catch (e) {
              Logger.log(e);
            }  
            //only one Slack message per session
            if ((hook_sent === false) && setup["webhook_url"] && (setup["webhook_url"] != "")) {
              hook_sent = true;
              let hook_payload = {"text" : 'PP Event Checker: ' + event["event_type"][1] + ' found. Message: ' + err +"\n" + loginfo};
              let hook_options = {'method' : 'post', 'muteHttpExceptions': false, 'contentType': 'application/json', 'payload' : JSON.stringify(hook_payload)};
              UrlFetchApp.fetch(setup["webhook_url"], hook_options);
            }                                  
          }
        });
      });
    }
  } catch(e) {
    Logger.log(e);
  };
  return res;
}
