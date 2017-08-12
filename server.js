const SERVER = process.env.SERVER_URL || "https://image-search-eliotn.c9users.io";
const PORT = process.env.PORT || 3000;
const IMGUR_KEY = process.env.IMGUR_KEY;
const mysql = require('mysql');
const moment = require('moment');
const request = require('request');
var pool = mysql.createPool(
  {
    connectionLimit : 10,
    host: 'localhost',
    user: process.env.C9_USER,
    password: '',
    database: 'c9'
  }
);

var http = require('http');
var path = require('path');
var express = require('express');

var router = express();

router.use(express.static(path.resolve(__dirname, 'client')));

router.listen(PORT, function() {
    console.log("listening on port " + PORT);
});

pool.query("CREATE TABLE IF NOT EXISTS searches("
  + "id INT NOT NULL,"
  + "modid INT NOT NULL,"
  + "searchstring VARCHAR(100) NOT NULL,"
  + "searchtime DATE,"
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
    //SET @rownumber = (SELECT COUNT(*) FROM searches); IF (@rownumber >= 25)" THEN END IF 
    //cool implementation of a queue, adapted from
    //https://www.xaprb.com/blog/2007/01/11/how-to-implement-a-queue-in-sql/
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
    request.get({url:'https://api.imgur.com/3/gallery/search/top/' + pagenum + '?q_exactly='
    + encodeURIComponent(req.params.searchstring),
    headers:{"Authorization":"Client-ID " + IMGUR_KEY}}, function (err, response, body) {
      
      if (err) { res.write(JSON.stringify({"err":err})); res.end(); }
      else {
        //console.log(response);
        //console.log(body);
        body = JSON.parse(body);
        var data = body["data"];
        var output = [];
        for (var i = 0; i < data.length; i++) {
          output.push({"page":"http://www.imgur.com/" + data[i]["id"], "image":data[i]["link"], "snippet":data[i]["title"]})
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