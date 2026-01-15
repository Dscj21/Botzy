const fs = require('fs');
const pngToIco = require('png-to-ico').default;

const inputPath = 'temp_icon.png';
const outputPath = 'build/icon.ico';

pngToIco([inputPath])
  .then(buf => {
    fs.writeFileSync(outputPath, buf);
    console.log('Icon converted successfully to ' + outputPath);
  })
  .catch(err => {
    console.error('Error converting icon:', err);
    process.exit(1);
  });
