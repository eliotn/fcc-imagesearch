//Image search Free code camp project - uses mysql to store image searches from an api and
//fetches the last 10 images.

const PORT = process.env.PORT || 8080;
const IMGUR_KEY = process.env.IMGUR_KEY;
const mysql = require('mysql');
const request = require('request');
var pool;
//connect to mysql database on c9 or on heroku
if (process.env.CLEARDB_DATABASE_URL) {//heroku
  pool = mysql.createPool(
    process.env.CLEARDB_DATABASE_URL
  );
}
else {//c9 - use mysql-cli start to start the database
  pool = mysql.createPool({   
    connectionLimit : 10,
    host: 'localhost',
    user: process.env.C9_USER,
    password: '',
    database: 'c9'
  });
}

var path = require('path');
var express = require('express');

var router = express();

router.listen(PORT, function() {
    console.log("listening on port " + PORT);
});

//create the table if it doesn't exist
pool.query("CREATE TABLE IF NOT EXISTS searches("
  + "id INT NOT NULL,"
  + "modid INT NOT NULL,"
  + "searchstring VARCHAR(100) NOT NULL,"
  + "searchtime DATETIME,"
  + "PRIMARY KEY (id),"
  + "UNIQUE KEY (modid)"
  + ")", function(error) {
  if (error) {
    console.log(error);
  }
});

//GET /api/images/:searchstring - store a search and do a search
//with imgur API
router.get('/api/imagesearch/:searchstring', function(req, res) {
  if (req.params.searchstring.length > 90) {
    res.write(JSON.stringify({"err":"your search query is too long"}));
  }
  else {
    
    var pagenum = req.query.offset || 1;
    
    //note: both async operations here can occur independently
    //Store the recent search as one of the top 10 searches
    //Thanks https://www.xaprb.com/blog/2007/01/11/how-to-implement-a-queue-in-sql/
    //for the idea for implementing a top 10 list
    pool.query("INSERT INTO searches (id, modid, searchstring, searchtime) "
    + "SELECT COALESCE(max(id), -1) + 1, (COALESCE(max(id), -1) + 1) mod 10, ?, NOW() "
    + "FROM searches "
    + "ON DUPLICATE KEY UPDATE "
    + "id = VALUES(id), "
    + "searchstring = ?, "
    + "searchtime = NOW() ",
        [req.params.searchstring, req.params.searchstring], function (error, results, fields) {
        if (error) { console.log(error); }
      }
    );
    //call the api, use q_any for a more permissive query
    request.get({url:'https://api.imgur.com/3/gallery/search/top/' + pagenum + '?q_any='
    + encodeURIComponent(req.params.searchstring),
    headers:{"Authorization":"Client-ID " + IMGUR_KEY}}, function (err, response, body) {
      
      if (err) { res.write(JSON.stringify({"err":err})); res.end(); }
      else {
        //format data from the api and write to the response
        body = JSON.parse(body);
        var data = body["data"];
        var output = [];
        for (var i = 0; i < data.length; i++) {
          output.push({"page":"http://www.imgur.com/" + data[i]["id"],
          "image":data[i]["link"],
          "snippet":data[i]["title"]})
        }
        res.write(JSON.stringify(output));
        res.end();
      }
      
    });
  }
});

//GET /api/latest/imagesearch
//Get last 10 search results, containing the term and
//when the search was done.
router.get('/api/latest/imagesearch', function(req, res) {
  pool.query("SELECT * FROM searches ORDER BY searchtime DESC LIMIT 10",
                                 function (error, results, fields) {
    if (error) { res.write(JSON.stringify({"err":error})); res.end(); }
    else {
      var output = [];
      for (var v of results) {
        output.push({"term":v.searchstring, "when":v.searchtime});
      }
      res.write(JSON.stringify(output));
      res.end();
    }
  });
});