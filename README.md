# Piwik PRO Broken Event Checker
GCP Cloud Function (optional: Apps Script version) for checking Piwik PRO Debugger API for broken events and sending debug info as Slack notification 

## Using Slack Messages
The function provided in this example uses a webhook to send Slack messages. For more information about how to receive messages in Slack using a Webhook visit [this help article from Slack](https://api.slack.com/messaging/webhooks). If you do not want to use this feature, you can adjust the code and delete or comment out the line beginning with `hook_response`. Note: you will only get logs in this case and have to look for messages there or use the App Script example or any other automation to receive emails with data about broken events instead.  

## Understanding the code
If you want to see how the cloud function works, how data is fetched from the API and extracted from the response in order to filter broken events, you can use the commented [Google Colab notebook](PiwikPRO_Broken_Events.ipynb) from this repository for a step-by-step explanation of the process.

## Getting API credentials
If you never used the API before, you will need a set of credentials before exexuting the code. The [Google Colab notebook](PiwikPRO_Broken_Events.ipynb) has a section about that topic and you can consult [this help file from Piwik PRO](https://help.piwik.pro/support/questions/generate-api-credentials/), too.

## Set-up Cloud Function
Create a new Cloud Funtion in GCP. Enter a name and activate *Allow unauthenticated invocations*.

### Configuration
Open the *Runtime, build, connections and security settings* block and create three runtime variables:

- `SLACK_WEBHOOK_URL`: add a complete webhook URL for your Slack app that can send a message whenever a broken event is found
- `PP_CLIENT_ID`: your API client ID from your Piwik PRO account (help article about [how to find API credentials](https://help.piwik.pro/support/questions/generate-api-credentials/))
- `PP_CLIENT_SECRET`: your API client secret from your Piwik PRO account

Note: This example uses simple environment variables for the API credentials. You might want to change this and use [secrets](https://cloud.google.com/functions/docs/configuring/secrets) instead. 

### Code 
In the *Code* section, pick the most current *Python* option. Replace the default contents for `main.py` and `requirements.txt` with the code from this repository.

#### Adjust code 
Enter your site id from Piwik PRO as `site_id` in the code and change the `site_url` to match your instance URL.  

### Finalize 
In order to test the function, change the `search_debug_type` variable value from *17* to one of the other event types from the comment like *4* for *Search* events, visit your site and perform a search in order to make sure there is at least one current session with a search event.  

If everything works, change `search_debug_type` back to *17* and deploy.

### Function response
The response will be a raw text (no HTML) with *"no events"* or a list of found broken events with their IDs, error messages from the session stream and a complete dump of the log stream for that certain event ID.  
## Schedule executions
The function checks the Debugger API for broken events in all debugger logs for the last 5 hours. You can use [GCP Cloud Scheduler to trigger the function](https://cloud.google.com/scheduler/docs/tut-gcf-pub-sub), automation tools like *Zapier*, *Make*, or a Google App Script with a scheduled trigger to call the HTTP trigger URL that starts your Cloud Function (as it is cunfigured to be available without authentification). If you want to trigger the function hourly, adjust the `lookup_window` parameter value.

Note: A response will be provided in every case, so make sure to only act if there is not just the standard *"no events"* response content.

### Example App Script
```
function checkBrokenEvents() {

  //TODO: ADD YOUR TRIGGER URL AND MAIL ADDRESS 
  var setupCloudFunctionTrigger = "https://your-instance-url.cloudfunctions.net/your-http-endpoint";
  var setupEmailAddress = "yourmail@example.com";
 
  var ApiResponse = UrlFetchApp.fetch(setupCloudFunctionTrigger, {muteHttpExceptions: true, followRedirects:false});
  var respCode = ApiResponse.getResponseCode();
  var res = ApiResponse.getContentText();

  if (respCode != 200) {
    Logger.log("ERROR: " + res);
    MailApp.sendEmail({
      to: setupEmailAddress,
      subject: "Error Executing Piwik PRO Event Checker!",
      htmlBody: "<p>Cloud Function threw an error (" + respCode + ").Message: "+res
    });  
  } else {
    
    //Check result
    if (res != "no events") {
      Logger.log("Sending result as email: " + res);
      MailApp.sendEmail({
        to: setupEmailAddress,
        subject: "Message from Piwik PRO Event Checker",
        htmlBody: res.replace(/\n/g, "<br>")
      });  

    } else {
      Logger.log("Done, no events found.");
    }  
  }    
}
```

### Use App Scripts for the whole thing
If you can or do not want to use a GCP Cloud Function for this check, you can use a Google Apps Script for the whole process. A basic example can be found in this repository as [example-app-script-code.gs](example-app-script-code.gs). You can use it as a staring point and add functionality like sending email notifications only once a day, deduplicating events and messages, storing more data in the spreadsheet or whatever you like.  

## Message volume control 
Per default, a limit of 10 sessions with broken events are processed and all broken events are reported seperately as a Slack message. If that floods your channel with too much (similar) messages, change the  `session_limit` variable that feeds the `limit` parameter of the `rep_response` API call. 

If you want to get *more* notifications, you can comment out the `break` command at the end of the *event* loop in order to get all broken events from a session instead of only the first as a sample and / or increase the session limit.
