var Twit = require('twit'),
    moment = require('moment'),
    MongoClient = require('mongodb').MongoClient,
    config = require('./config');

function formatDate(dt, fmt) {
    fmt = (fmt == null) ? "Do MMMM YYYY, h:mm:ss a (UTCZZ)" : fmt;
    return moment(new Date(dt)).format(fmt);
}

function layoutTweetHTML(tweet) {
    return "<p style='border: 1px solid gray; padding: .5em'>" + tweet.text + "</p>\n" +
           "<p>" + formatDate(tweet.created_at) + "</p>\n" + 
           "<a href='#'>Undo</a>\n" +
           "<pre>" + JSON.stringify(tweet, null, 2) + "</pre>"; 
}

function layoutTweetLog(tweet, action) {
    return "[" + formatDate(tweet.created_at, "YYYY-MM-DD HH:mm:ss") + 
           "][" + action + "][" + tweet.id + "] " + tweet.text;
}
   
function main(db) {
    var tweets = db.collection('tweets'),
        deletes = db.collection('deletes'),
        userEvents = db.collection('userEvents'),
        twitter = new Twit(config.api),
        stream = twitter.stream('user', {"with": "user"});

    stream.on('tweet', function(tweet) {
        if (tweet.user.screen_name == config.screen_name) {
            console.log(layoutTweetLog(tweet, 'INSERT'));
        } else if (tweet.user.screen_name != config.screen_name) {
            // Someone retweeted us. Ignore.
        } else if (config.debug) {
            console.error("Unknown tweet signature:");
            console.error(tweet);
        }

        tweets.insert(tweet, function(err) {
            if (err) console.error(err.stack);
        });
    });

    stream.on('delete', function(event) {
        if (event == null || event['delete'] == null || event['delete']['status'] == null) {
            console.error("Unknown delete signature:");
            console.error(event);
            return;
        }

        // Unnecessary nesting.
        event = event['delete']['status'];

        events.findOne({id: event.id}, function(err, record) {
            if (err) console.error(err.stack);

            if (record) {
                console.log(layoutTweetLog(record, 'DELETE'));
            } else {
                console.log(layoutTweetLog({ id: event.id,
                                             created_at: Date.now(), 
                                             text: "*UNKNOWN - not in db*" }, 'DELETE'));
            }
        });
        
        deletes.insert(tweet, function(err) {
            if (err) console.error(err.stack);
        });
    });

    stream.on('user_event', function(event) {
        userEvents.insert(event, function(err) {
            if (err) console.error(err.stack);
        });
    });
}

MongoClient.connect(config.mongoURL, function(err, db) {
    if (err) throw err;
    main(db);
});
