const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();
/*
//API 0:Display userTable
app.get("/displayuser/", async (request, response) => {
  const selectUserQuery = `SELECT * FROM user;`;
  const dbUser = await db.all(selectUserQuery);
  response.send(dbUser);
});

app.get("/displayfollower/", async (request, response) => {
  const selectUserQuery = `SELECT * FROM follower;`;
  const dbUser = await db.all(selectUserQuery);
  response.send(dbUser);
});

app.get("/displaytweet/", async (request, response) => {
  const selectUserQuery = `SELECT * FROM tweet;`;
  const dbUser = await db.all(selectUserQuery);
  response.send(dbUser);
});

app.get("/displaylike/", async (request, response) => {
  const selectUserQuery = `SELECT * FROM like;`;
  const dbUser = await db.all(selectUserQuery);
  response.send(dbUser);
});

app.get("/displayreply/", async (request, response) => {
  const selectUserQuery = `SELECT * FROM reply;`;
  const dbUser = await db.all(selectUserQuery);
  response.send(dbUser);
});
*/

//API 1: REGISTER AN ACCOUNT
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = `SELECT username FROM user WHERE username='${username}'`;
  let ps = password.length;
  let sig = 1;
  if (ps < 6) sig = 0;
  const hashedPassword = await bcrypt.hash(password, 10);
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (sig == 0) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
        INSERT INTO 
            user (username, password, name, gender)
        VALUES 
            (
            '${username}', 
            '${hashedPassword}', 
            '${name}',
            '${gender}'
            )`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.status(200);
      response.send(`User created successfully`);
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2: LOGIN TO AN ACCOUNT
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken: `${jwtToken}` });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//MIDDLEWARE to Authenticate token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 3: Returning feed
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getF1ID = `SELECT user_id FROM user WHERE username = '${username}'`;
  const F1ID = await db.get(getF1ID);
  const Get_Followings_Query = `
    SELECT *
    FROM follower
    WHERE follower_user_id='${F1ID.user_id}'`;
  const Followings = await db.all(Get_Followings_Query); ////////////////////////////////////////////////
  const GetTweetsQuery = `
    SELECT f.username,
        t.tweet,
        t.date_time
    FROM tweet AS t
    INNER JOIN 
    (
        SELECT follower_id,following_user_id,u.username AS username
        FROM follower
        INNER JOIN
        (
            SELECT user_id,username
            FROM user
        ) AS u
            ON following_user_id=u.user_id
        WHERE follower_user_id='${F1ID.user_id}'
    ) AS f
        ON t.user_id=f.following_user_id
    ORDER BY t.date_time DESC;
    LIMIT 4`;
  const tweetsTable = await db.all(GetTweetsQuery);
  //console.log(tweetsTable);
  response.send(tweetsTable);
});

//API 4: Returning user followings
app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getF1ID = `SELECT * FROM user WHERE username = '${username}'`;
  const F1ID = await db.get(getF1ID);
  const Get_Followings_Query = `
    SELECT user.name
    FROM follower
        INNER JOIN user
    ON follower.following_user_id=user.user_id
    WHERE follower.follower_user_id='${F1ID.user_id}'`;
  const Followings = await db.all(Get_Followings_Query);
  //console.log(Followings);
  response.send(Followings);
});

//API 5: Returning user followers
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getF1ID = `SELECT * FROM user WHERE username = '${username}'`;
  const F1ID = await db.get(getF1ID);
  const Get_Followings_Query = `
    SELECT user.name
    FROM follower
        INNER JOIN user
    ON follower.follower_user_id=user.user_id
    WHERE follower.following_user_id='${F1ID.user_id}'`;
  const Followers = await db.all(Get_Followings_Query);
  //console.log(Followers);
  response.send(Followers);
});

//API 6: Returning tweet
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const getTweetQuery = `SELECT * FROM tweet WHERE tweet_id='${tweetId}'`;
  const tweet = await db.get(getTweetQuery);
  const getUserId = `
        SELECT user_id
        FROM user
        WHERE username='${username}'`;
  const userId = await db.get(getUserId);
  const checkFollowingQuery = `
    SELECT follower.follower_id
    FROM tweet
        INNER JOIN follower
    ON tweet.user_id=follower.following_user_id AND tweet.tweet_id='${tweetId}'
    WHERE follower.follower_user_id='${userId.user_id}'`;

  const sig = await db.get(checkFollowingQuery);
  //console.log(sig);
  if (sig === undefined) {
    console.log("e");
    response.status(401);
    response.send("Invalid Request");
  } else {
    const likeQuery = `
        SELECT COUNT(like_id)
        FROM like
        WHERE tweet_id='${tweetId}'`;

    const replyQuery = `
        SELECT COUNT(reply_id)
        FROM reply
        WHERE tweet_id='${tweetId}'`;

    const l = await db.all(likeQuery);
    const r = await db.all(replyQuery);

    //console.log(l[0]["COUNT(like_id)"]);
    //console.log(r[0]["COUNT(reply_id)"]);

    const final = {
      tweet: `${tweet.tweet}`,
      likes: l[0]["COUNT(like_id)"],
      replies: r[0]["COUNT(reply_id)"],
      dateTime: `${tweet.date_time}`,
    };

    response.send(final);
  }
});

//API 7: Returning liked profiles
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getTweetQuery = `SELECT * FROM tweet WHERE tweet_id='${tweetId}'`;
    const tweet = await db.get(getTweetQuery);
    const getUserId = `
        SELECT user_id
        FROM user
        WHERE username='${username}'`;
    const userId = await db.get(getUserId);

    const checkFollowingQuery = `
        SELECT f.follower_id
        FROM follower AS f
        INNER JOIN
        (
            SELECT user_id
            FROM tweet
            WHERE tweet_id='${tweetId}'
        ) AS t
            ON t.user_id=f.following_user_id
        WHERE f.follower_user_id='${userId.user_id}'`;

    const sig = await db.get(checkFollowingQuery);
    console.log(sig);
    if (sig === undefined) {
      //console.log("e");
      response.status(401);
      response.send("Invalid Request");
    } else {
      const likeQuery = `
        SELECT user.username
        FROM like
            INNER JOIN user
        ON like.user_id=user.user_id
        WHERE like.tweet_id = '${tweetId}'`;

      const getUsername = await db.all(likeQuery);
      let s = getUsername.length;
      let arr = [];
      for (let i = 0; i < s; i++) {
        arr.push(getUsername[i].username);
      }
      const a = {
        likes: arr,
      };
      //console.log(arr);
      //console.log(Object.values(getUsername));
      response.send(a);
    }
  }
);

//API 8: Returning replies of a tweet
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getTweetQuery = `SELECT * FROM tweet WHERE tweet_id='${tweetId}'`;
    const tweet = await db.get(getTweetQuery);

    const getUserId = `
        SELECT user_id
        FROM user
        WHERE username='${username}'`;
    const userId = await db.get(getUserId);
    const checkFollowingQuery = `
        SELECT follower.follower_user_id
        FROM tweet
            INNER JOIN follower
        ON tweet.user_id=follower.following_user_id AND tweet.tweet_id='${tweetId}'
        WHERE follower.follower_user_id='${userId.user_id}'`;

    const sig = await db.get(checkFollowingQuery);
    console.log(sig);

    if (sig === undefined) {
      console.log(userId);
      response.status(401);
      response.send("Invalid Request");
    } else {
      const replyQuery = `
        SELECT user.name,reply.reply
        FROM reply
            INNER JOIN user
        ON reply.user_id=user.user_id
        WHERE reply.tweet_id = '${tweetId}'`;

      const getReply = await db.all(replyQuery);
      let s = getReply.length;
      let arr = { replies: getReply };
      response.send(arr);
    }
  }
);

//API 9: Returning all user tweets
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserId = `
    SELECT user_id
    FROM user
    WHERE username='${username}'`;
  const userId = await db.get(getUserId);

  const getTweetsQuery = `
    SELECT t.tweet,l.likes AS likes,r.replies AS replies,t.date_time
    FROM tweet AS t
    LEFT JOIN
    (
        SELECT tweet_id,COUNT(like_id) as likes
        FROM like
        GROUP BY tweet_id
    )AS l
        ON t.tweet_id= l.tweet_id
    LEFT JOIN
    (
        SELECT tweet_id,COUNT(reply_id) as replies
        FROM reply
        GROUP BY tweet_id
    )AS r
        ON t.tweet_id= r.tweet_id
    WHERE t.user_id='${userId.user_id}'`;
  const tweets = await db.all(getTweetsQuery);

  let ts = tweets.length;
  /*for (let i = 0; i < ts; i++) {
    if (tweet[i].likes ==null) tweets[i].likes = 0;
    if (tweet[i].replies ===null) tweets[i].replies = 0;
  }*/
  response.send(tweets);
});

//API 10: Posting tweets
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  const getUserId = `
    SELECT user_id
    FROM user
    WHERE username='${username}'`;
  const userId = await db.get(getUserId);
  let date_ob = new Date();
  let date = ("0" + date_ob.getDate()).slice(-2);
  let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
  let year = date_ob.getFullYear();
  let hours = date_ob.getHours();
  let minutes = date_ob.getMinutes();
  let seconds = date_ob.getSeconds();
  let dt =
    year +
    "-" +
    month +
    "-" +
    date +
    " " +
    hours +
    ":" +
    minutes +
    ":" +
    seconds;

  const TweetQuery = `
    INSERT INTO tweet(tweet,user_id,date_time)
    VALUES ('${tweet}','${userId.user_id}','${dt}')`;

  const dbResponse = await db.run(TweetQuery);
  response.status(200);
  response.send("Created a Tweet");
});

//API 11: Delete tweet
app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;
  const getUserId = `
    SELECT user_id
    FROM user
    WHERE username='${username}'`;
  const userId = await db.get(getUserId);
  const getTweetQuery = `
    SELECT user_id
    FROM tweet
    WHERE tweet_id='${tweetId}'`;
  const tweet = await db.get(getTweetQuery);
  if (tweet.user_id === userId.user_id) {
    const deleteTweetQuery = `
            DELETE FROM
                tweet
            WHERE tweet_id='${tweetId}'`;
    const deleteLikeQuery = `
            DELETE FROM
                like
            WHERE tweet_id='${tweetId}'`;
    const deleteReplyQuery = `
            DELETE FROM
                reply
            WHERE tweet_id='${tweetId}'`;

    const dbResponse1 = await db.run(deleteTweetQuery);
    const dbResponse2 = await db.run(deleteLikeQuery);
    const dbResponse3 = await db.run(deleteReplyQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 12: To Like a tweet
app.post("tweet/:tweetId/like/", authenticateToken, async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserId = `
        SELECT user_id
        FROM user
        WHERE username='${username}'`;
    const userId = await db.get(getUserId);
    const userId = await db.get(getUserId);

    /// Checking Date_time
    let date_ob = new Date();
    let date = ("0" + date_ob.getDate()).slice(-2);
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let year = date_ob.getFullYear();
    let hours = date_ob.getHours();
    let minutes = date_ob.getMinutes();
    let seconds = date_ob.getSeconds();
    let dt =
        year +
        "-" +
        month +
        "-" +
        date +
        " " +
        hours +
        ":" +
        minutes +
        ":" +
        seconds;


    const likeTweetQuery=`
        INSERT INTO like(tweet_id,user_id,date_time)
        VALUES 
            (
            '${tweetId}', 
            '${userId.user_id}', 
            '${dt}',
            )`;
    
    const dbResponse=await db.run(likeTweetQuery);
    response.status(200);
    response.send("User Liked Successfully");

});


//API 13: To reply to a tweet
app.post("tweet/:tweetId/reply", authenticateToken, async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const { reply }=request.body
    const getUserId = `
        SELECT user_id
        FROM user
        WHERE username='${username}'`;
    const userId = await db.get(getUserId);
    const userId = await db.get(getUserId);

    /// Checking Date_time
    let date_ob = new Date();
    let date = ("0" + date_ob.getDate()).slice(-2);
    let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
    let year = date_ob.getFullYear();
    let hours = date_ob.getHours();
    let minutes = date_ob.getMinutes();
    let seconds = date_ob.getSeconds();
    let dt =
        year +
        "-" +
        month +
        "-" +
        date +
        " " +
        hours +
        ":" +
        minutes +
        ":" +
        seconds;


    const replyTweetQuery=`
        INSERT INTO reply(tweet_id,reply,user_id,date_time)
        VALUES 
            (
            '${tweetId}', 
            '${reply}'
            '${userId.user_id}', 
            '${dt}',
            )`;
    
    const dbResponse=await db.run(replyTweetQuery);
    response.status(200);
    response.send("Reply Successful");

});

module.exports = app;
