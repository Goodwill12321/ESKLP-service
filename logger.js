
var fs = require('fs');

function formatDate(date, delim = '-') {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join(delim);
}


function checkCreateFolderAndWrite(folder, text, filename, callback) {
    fs.access(folder, fs.F_OK, (err) => {
        if (err) {
            fs.mkdir(folder, (err) => {
              if (err) {
                console.error('Ошибка при создании каталога: ' + folder, err);
              } else {
                callback(text, folder, filename);
              }
              
              });
        }
        callback(text, folder, filename);
      })
}

function appendTextToFile(text, folder, fileName) {
    fs.appendFile(folder + "/" + fileName, text, err => {
        if (err) {
            console.error(err);
        }
    });    
}


function logging(prefix, message, isError = false) {
    let date = new Date();
    let datStr = formatDate(date, "_");
    
    let fileName = prefix + "_" + datStr + (isError ? '_error.log':'_common.log');
    let timePrefix = "[" + date.toLocaleTimeString("ru") + "] ";
    checkCreateFolderAndWrite('log', timePrefix +  message + '\n', fileName, appendTextToFile);
   
    if (isError) 
        console.error(timePrefix +  message);
    else
        console.log(timePrefix + message);    
}

module.exports = logging;