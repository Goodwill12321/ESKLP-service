const fs = require('fs');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const https = require('https');

const agent = new https.Agent({
            rejectUnauthorized: false,
            requestCert: false,
            agent: false,
    });


const parser = require('./parser-sax.js');
const logging = require('./logger.js');




async function loadLastFile_FromHTTP(downloadDir)
{
    let destinationPath = ''
    try {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 
        sURL = 'https://esklp.egisz.rosminzdrav.ru/fs/public/api/esklp/?exportType=full&exportFormat=XML&sorting=createTimestamp__desc'
        const res = await fetch(sURL, {agent});
        //const headerDate = res.headers && res.headers.get('date') ? res.headers.get('date') : 'no response date';
        console.log('Status Code:', res.status);
        //console.log('Date in Response header:', headerDate);

        const files = await res.json();

        for(file of files.results) {
            let fullName = `${file.fileName}.${file.fileExt}`
            let fileNameLocal = downloadDir + "/" + fullName;
            if (!(await parser.checkStartLoad(file.fileName)))
            {   
                logging('ftp', 'File ' + fileNameLocal + ' have been already started load!');
                return null;
            }
            
            if ((await parser.fileAlreadyLoaded(fullName)))
            {   
                logging('ftp', 'File ' + fileNameLocal + ' have been already loaded in DB');
                return null;
            }
            console.log(`Got file with id: ${file.fileId}, name: ${file.fileName} , createTimestamp: ${file.createTimestamp}, fileSize: ${file.fileSize}, exportType: ${file.fileKeyValueAttributes.exportType}`);
            sURL = `https://esklp.egisz.rosminzdrav.ru/fs/public/api/esklp/download/${file.fileId}`
            const response = await fetch(sURL, {agent});
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
            }

            destinationPath = fileNameLocal
            const body = Readable.fromWeb(response.body);
            const download_write_stream = fs.createWriteStream(destinationPath);
            await finished(body.pipe(download_write_stream));
            console.log(`File downloaded successfully to ${destinationPath}`);
            break
        }
    } catch (err) {
        console.log(`URL = ${sURL}`)  
        console.log(err.message); //can be console.error
        console.log(err.cause.message); //can be console.error
    }         
    return destinationPath          
}

async function loadLastFile(downloadDir)
{
    destPath = await loadLastFile_FromHTTP(downloadDir);
    return destPath
}


if (require.main === module) {
    loadLastFile('.').then(destPath=>{console.log(destPath)});
    
}

exports.loadLastFile = loadLastFile;
