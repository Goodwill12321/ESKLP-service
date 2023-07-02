const MongoClient = require("mongodb").MongoClient;
const fs = require("fs");



const client = new MongoClient("mongodb://127.0.0.1:27017");
 

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
      if (batchTemp.length < 10) {
        batchTemp.push(data);
        //xml.resume();
        ins ++;
        if (ins % 10 == 0)
          console.info("➕  ", ins); 
      } else {
        
       // xml.pause();
        if (batchTemp.includes(data))
          console.log("Duplicate object " + data);
        else
        {
          batchTemp.push(data);
          collection.insertMany(batchTemp).then(result => {
            //console.log(data);
              console.info("➕  " + ins + " all " + cnt_all);
              batchTemp = [];
              //xml.resume()
            }, 
            err =>{
              console.log(data);
              Errors.push(err);
              //xml.resume();
              batchTemp = [];
            })
        }
      }
    }
  }
  

  function normalizeProduct(product) {
    product.children = null;
    if (product['SMNN_LIST'])
      for (child of product['SMNN_LIST'].children)
        for (key in child) {
          if (child[key]['children'] && child[key]['children'].length == 1){
            key.key_value = child[key]['children'][0];
          }
      }      
  }

  console.log("Current directory:", __dirname);

  /*const streamWrite = fs.createWriteStream("./data/extract.json");
  function saveToFile(data) {
    streamWrite.write(data);
  }*/
 
  const path = require('path')
  const clientPath = path.join(__dirname, 'data/esklp_20230602_active_21.5_00001_0001.xml')
  //const stream = fs.createReadStream  ("/home/victor/projects/Node/esklp/data/esklp_20230602_active_21.5_00001_0001.xml");
  
  
  //var parser = sax.parser(true);

  var sax = require('./sax.js')

  var saxStream = sax.createStream(false)

  const tagCollect = "NS2:GROUP";
  products = []
  product = undefined
  currentTag = undefined

  saxStream.on("closetag" , function (tagName) {
    cnt_all ++;
    if (tagName === tagCollect && product != null) {
        if (product.children.length > 1)
        {
          if (product.parent)
          { //product.parent = null;
            product.parent.children = null;
            if (product.parent.parent) {
              product.parent.parent.children = null;
              if (product.parent.parent.parent)
                  product.parent.parent.parent = null;  
            }    
          }
          normalizeProduct(product);
          products.push(product)
          saveDataBatch(product)
          currentTag = product = null
          return
        }
    }
    if (currentTag && currentTag.parent) {
      var p = currentTag.parent
      delete currentTag.parent
      currentTag = p
    }
    //console.log(tagName);
  })

  saxStream.on("opentag" ,  function (tag) {
    if (tag.name !== tagCollect && !product) return
    if (tag.name === tagCollect) {
      product = tag
    }
    tag.parent = currentTag
    tag.children = []
    tag.parent && tag.parent.children.push(tag)
    if(tag.parent)
      tag.parent[tag.name.replace('NS2:', '')] = tag;
    currentTag = tag
    //console.log(tag.name);
  })

  saxStream.on("text", function (text) {
    if (currentTag) 
      currentTag.children.push(text)
    //console.log(text);
  });

  const stream = fs.createReadStream(clientPath)
      .pipe(saxStream);
      //"/home/victor/projects/Node/esklp/data/esklp_20230621_full_21.5_00001_0001.xml");

  //const stream = fs.createReadStream("./esklp/data/1.xml");

  /*const xml = new XmlStream(stream);
 
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
  
  xml.on("end", function() {
    // client.close();
    console.error(JSON.stringify(Errors));
    console.log("🔥  END");
  });*/


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