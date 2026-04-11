const SFTPClient = require('ssh2-sftp-client')
const fs = require('fs')

async function upload() {
  const sftp = new SFTPClient()
  try {
    const keyPath = process.env.BOT_SSH_KEY_PATH || `${process.env.HOME}/.ssh/pkdex_sysbot`
    const privateKey = fs.readFileSync(keyPath)
    
    await sftp.connect({
      host: '100.90.194.72',
      port: 22,
      username: 'pkdexssh',
      privateKey,
      readyTimeout: 10000
    })
    
    console.log('Connected! Uploading BotConnector.js...')
    await sftp.put('/Users/johan/Desktop/Proyectos/Pokémon SysBot Automation (SaaS)/pkhex-generator/BotConnector.js', '/C:/pkgenerator/BotConnector.js')
    console.log('Upload complete!')
  } catch (err) {
    console.error('Error:', err)
  } finally {
    sftp.end()
  }
}

upload()
