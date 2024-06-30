#LIST BROKEN EVENTS
import requests
import json
import os

search_debug_type = 17 #8 = Goal, 4 = Search, 17 = broken event, 18 = excluded event
site_id = "bb338e1a-12f8-5353-ac63-9fd8b1f928a1"

#+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

webhook_url = os.environ.get('SLACK_WEBHOOK_URL')
credentials = {
  "client_id": os.environ.get('PP_CLIENT_ID'),
  "client_secret": os.environ.get('PP_CLIENT_SECRET'),
  "instance_url": "https://mbsl.piwik.pro"
}

def get_auth_token(credentials):
    auth_body = {"grant_type": "client_credentials", "client_id": credentials["client_id"], "client_secret": credentials["client_secret"]}
    return requests.post(credentials["instance_url"] + '/auth/token', data=auth_body).json()["access_token"]

def do_check(args):
    res = ""
    token = get_auth_token(credentials)

    try:
        rep_response = requests.get(credentials["instance_url"] + '/api/tracker/v1/debugger?app_id='+site_id+'&lookup_window=300&event_type='+str(search_debug_type), headers={"Authorization": 'Bearer ' + token})
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            print("Auth token is no longer valid.")
        else:
            print("Request error occured.")
            raise

    cnt = rep_response.content.decode()
    if (cnt == ""):
        res = "no events"
    else:      
        sessions = cnt.split("\n")
        for session in sessions:
            try:
                json_session = json.loads(session)
                rep_start = json_session["server_time"]
                rep_end = json_session["updated_at"]
                events =  json_session["events"]
                for event in events:
                    #Sample für erstes passendes Event auslesen und Schleife beenden
                    if event["event_type"][0] == search_debug_type:
                        event_id = str(event["event_id"])
                        res += "found " + event["event_type"][1] + ", ID: " + event_id + "\n"
                        err = "no errors"
                        if "error_message" in event:
                            err = event["error_message"]
                            #Debug - Daten zum Event aus dem Log abrufen 
                            log_response = requests.get(credentials["instance_url"] + '/api/tracker/v1/log?app_id='+site_id+'&event_ids='+event_id+'&server_time_min=' + rep_start + '&server_time_max=' + rep_end, headers={"Authorization": 'Bearer ' + token})
                            err += "\n\nLOG:\n----n" + log_response.content.decode()
                        res += err  + "\n"
                        hook_payload = {"text" : 'PP Event Checker: ' + event["event_type"][1] + ' hat folgende Meldung erzeugt: ' + err}
                        hook_response = requests.post(webhook_url, headers = {"Content-type": 'application/json'}, json = hook_payload)
                        break
            except:
                res += "error parsing session\n"
    return res