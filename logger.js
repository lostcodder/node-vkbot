var winston = require('winston');

module.exports = new winston.Logger({
    exitOnError: false,
    levels: {
        'error': 0,
        'warning': 1,
        'verbose':2
    },
    transports: [
    new winston.transports.File({
        filename: __dirname + '/' + 'vkbot.log',
        level: 'warning'
    }),
    new winston.transports.Console({level: 'warning', colorize: true})
    ],
});