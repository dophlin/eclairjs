/*
 * Copyright 2015 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function exit() {
  process.exit(0);
}

function stop(e) {
  if (e) {
    console.log('Error:', e);
  }

  if (sparkContext) {
    sparkContext.stop().then(exit);
  }
}

var eclairjs = require('../../client/lib/index.js');
var spark = new eclairjs();
var sparkContext = new spark.SparkContext("local[*]", "Twitter Popular Tags");
var ssc = new spark.streaming.StreamingContext(sparkContext, new spark.streaming.Duration(1000));

var filters = [];

var consumerKey = "7LuUEJxzr54zjZWKQ33Xbh9Mp";
var consumerSecret = "BBtcoOlA03jNKZzxAkgoNeaWuTmG9eWqmVP8ci3s7p79jemuDE";
var accessToken = "120219541-vDombACsJtBOjZgfuRJbQdR67emzg7tRbdX1qGbO";
var accessTokenSecret = "IYu14bHbe8ppwgcXYRatitvmKDV1v6SiUwWtZ3r4tECPV";

var auth= new spark.streaming.twitter.TwitterAuthorization(consumerKey ,consumerSecret, accessToken, accessTokenSecret);
var stream = spark.streaming.twitter.TwitterUtils.createStream(ssc, auth, filters);

var hashTags = stream.flatMap(function(status){
  return status.getText().split(" ");
}).filter(function(s) {
  return s.startsWith("#");
});

var topCounts60 = hashTags.mapToPair(function (s, Tuple2) {
  return new Tuple2(s, 1.0);
}, [spark.Tuple2]).reduceByKeyAndWindow(function (i1, i2) {
    return i1 + i2;
  }, new spark.streaming.Duration(10000))
  .mapToPair(function (tuple, Tuple2) {
    return new Tuple2(tuple._2(), tuple._1());
  }, [spark.Tuple2]).transformToPair(function (rdd) {
    return rdd.sortByKey(false);
  });

// Print popular hashtags
topCounts60.foreachRDD(function(rdd) {
  return rdd.take(10);
}, null, function(res) {
  console.log('top 10:', res)
}).then(function () {
  ssc.start();
}, stop);

// stop spark streaming when we stop the node program
process.on('SIGTERM', stop);
process.on('SIGINT', stop);