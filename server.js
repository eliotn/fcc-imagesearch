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
router.get('/api/imagesearch/:searchstring', function(req, res) {
  if (req.params.searchstring.length > 90) {
    res.write(JSON.stringify({"err":"your search query is too long"}));
  }
  else {
    var pagenum = req.query.offset || 1;
    pool.query("INSERT INTO searches (searchstring, searchtime) VALUES (?, NOW())",
          [req.params.searchstring], function (error, results, fields) {
            if (error) { console.log(error); }
    });
    request.get({url:'https://api.imgur.com/3/gallery/search/top/' + pagenum + '?q_exactly='
    + encodeURIComponent(req.params.searchstring),
    headers:{"Authorization":"Client-ID " + IMGUR_KEY}}, function (err, response, body) {
      
      if (err) { res.write(JSON.stringify({"err":err})); res.end(); }
      else {
        //console.log(response);
        //console.log(body);
        body = JSON.parse(body);
        var data = body["data"];
        console.log(data[0])
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