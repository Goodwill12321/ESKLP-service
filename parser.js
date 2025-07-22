const MongoClient = require("mongodb").MongoClient;
const fs = require("fs");
const XmlStream = require("xml-stream");
 
const client = db.mongo;;
 

client.connect().then((mongoClient=>{
  console.log("Подключение установлено");
  //console.log(mongoClient.options.dbName); // получаем имя базы данных
  //console.log("Connected successfully to server");
 
  let ins = 0;
  let cnt_all = 0;
  let Errors = [];
  const db = client.db("esklp");
  const collection = db.collection("mnn");
 
 /* function saveData(data) {
    if (data instanceof Object) {
      xml.pause();
      data["key_name"] = data["$"]  
      data["$"] ? delete data["$"] : null;
      collection.insertOne(data).then(result => {
          //console.log(data);
          console.info("➕  ", c);
          xml.resume()}, 
          err =>{
            console.log(data);
            Errors.push(err);
            xml.resume();
          } 
      );
      //xml.resume();
    }
    //console.log(data);
  }*/
 
  let batchTemp = [];
  function saveDataBatch(data) {
    if (data instanceof Object) {
      //xml.pause();
      data["key_name"] = data["$"] 
      data["$"] ? delete data["$"] : null;
      if (batchTemp.length < 500) {
        batchTemp.push(data);
        //xml.resume();
        if (ins % 10 == 0)
          console.info("➕  ", ins); 
      } else {
        
        xml.pause();

        if (batchTemp.includes(data))
          console.log("Duplicate object " + data);
        else
          batchTemp.push(data);
        
          collection.insertMany(batchTemp).then(result => {
          //console.log(data);
            console.info("➕  " + ins + " all " + cnt_all);
            batchTemp = [];
            xml.resume()}, 
          err =>{
            console.log(data);
            Errors.push(err);
            xml.resume();
            batchTemp = [];
          });
      }
    }
  }
  
  console.log("Current directory:", __dirname);

  /*const streamWrite = fs.createWriteStream("./data/extract.json");
  function saveToFile(data) {
    streamWrite.write(data);
  }*/
 
  const path = require('path')
  const clientPath = path.join(__dirname, 'data/esklp_20230621_full_21.5_00001_0001.xml')
  //const stream = fs.createReadStream  ("/home/victor/projects/Node/esklp/data/esklp_20230602_active_21.5_00001_0001.xml");
  const stream = fs.createReadStream(clientPath);//"/home/victor/projects/Node/esklp/data/esklp_20230621_full_21.5_00001_0001.xml");
  
  //const stream = fs.createReadStream("./esklp/data/1.xml");

  const xml = new XmlStream(stream);
 
  xml.preserve('ns2:grouplist', true);
  xml.collect('ns2:group');
  xml.on('endElement: ns2:group', function(item) {
    if (typeof item['ns2:smnn_list'] != 'undefined') 
    {
      saveDataBatch(item);
      ins++;
    }    
    cnt_all++;
    //console.log(item);
  });
  
  //xml.collect("ns2:group");
  //xml.preserve('id', true);
  /*xml.on("endElement: id", function(item) {
    saveData(item);
    c++;
  });*/
 
  xml.on("end", function() {
    // client.close();
    console.error(JSON.stringify(Errors));
    console.log("🔥  END");
  });
}), err =>{
  console.log(err);
} );




/*client.connect(function(err) {
  if (err) {
    throw new Error("db connection error", err);
  }
  console.log("Connected successfully to server");
 
  let c = 0;
  let Errors = [];
  const db = client.db("esklp");
  const collection = db.collection("mnn");
 
  function saveData(data) {
    if (data instanceof Object) {
      xml.pause();
      data["$"] ? delete data["$"] : null;
      collection.insertOne(data, (err, res) => {
        if (err) {
          console.error("insertOne: ", err);
          Errors.push(err);
        } else {
          console.clear();
          console.log(data);
          console.info("➕  ", c);
          xml.resume();
        }
      });
    }
  }
 
  let batchTemp = [];
  function saveDataBatch(data) {
    if (data instanceof Object) {
      xml.pause();
      data["$"] ? delete data["$"] : null;
      if (batchTemp.length < 100) {
        batchTemp.push(data);
      } else {
        batchTemp.push(data);
        collection.insertMany(batchTemp, (err, res) => {
          if (err) {
            console.error("insertMany: ", err);
            Errors.push(err);
          } else {
            console.clear();
            console.log(data);
            console.info("➕  ", c);
            batchTemp = [];
            xml.resume();
          }
        });
      }
    }
  }
 
  const streamWrite = fs.createWriteStream("./data/extract.json");
  function saveToFile(data) {
    streamWrite.write(data);
  }
 
  const stream = fs.createReadStream("./data/esklp_20230602_active_21.5_00001_0001.xml");
  const xml = new XmlStream(stream);
 
  xml.on("endElement: SUBJECT", function(item) {
    saveData(item);
    c++;
  });
 
  xml.on("end", function() {
    // client.close();
    console.error(JSON.stringify(Errors));
    console.log("🔥  END");
  });
});*/