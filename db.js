const MongoClient = require("mongodb").MongoClient;
const mongo = new MongoClient("mongodb://esklpuser:6jwQpqreXTqJ@mongodb:27017");

exports.mongo = mongo;