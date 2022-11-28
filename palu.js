require('dotenv').config()
var request = require('request');
const cron = require('cron');
const fs = require("fs");
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ], partials: [Partials.Channel]
});

let guild
const config = require("./config/config.json");

client.login(process.env.TOKEN);

client.on("ready", async () => {
    guild = await client.guilds.fetch(config.guild)
    console.log(`${client.user.tag} is ready!`)

    await eteindrePrise()
    await wait(2000)
    // check if we are after 10am and before 10pm
    const now = new Date()

    if (now.getHours() >= config.heures.jour.debut && now.getHours() < config.heures.jour.fin) {
        allumerLumiere()
    } else if (now.getHours() >= config.heures.crepuscule.debut && now.getHours() < config.heures.crepuscule.fin) {
        allumerLumBleue()
    } else {
        eteindreLumieres()
    }

    let debutJour = new cron.CronJob(`00 ${config.heures.jour.debut} * * *`, allumerLumiere);
    debutJour.start();
    let finJour = new cron.CronJob(`00 ${config.heures.jour.fin} * * *`, () => {
        allumerLumBleue()
        eteindreLumiere()
    });
    finJour.start();


    let nuit = new cron.CronJob(`00 ${config.heures.crepuscule.fin} * * *`, eteindreLumieres);
    nuit.start();

    let vapo = new cron.CronJob(`00  ${config.heures.vapo.debut}-${config.heures.vapo.fin}/${config.heures.vapo.ratio} * * *`, vaporisations10s);
    vapo.start();

    let plot = new cron.CronJob(`2/15 * * * *`, plotingTempHum)
    plot.start()
    plotingTempHum()

    return
})

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.channel.type === "dm") return;
    if (!message.content.startsWith(config.prefix)) return;
    const args = message.content.substring(config.prefix.length).trim().split(" ");
    const command = args.shift().toLowerCase();
    switch (command) {
        case "setup": {
            if (!message.member.permissions.has("ADMINISTRATOR")) break
            message.delete();
            const humEmbed = new EmbedBuilder()
                .setTitle("Humidité")
                .setColor("#3C63AD")
                .setTimestamp()
            const tempEmbed = new EmbedBuilder()
                .setTitle("Température")
                .setColor("#A23923")
                .setTimestamp()
            await message.channel.send({ embeds: [humEmbed] })
            await message.channel.send({ embeds: [tempEmbed] })


            const embed = new EmbedBuilder()
                .setTitle("Controle du paludarium")
                .setColor("#a6d132")
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("lightOn")
                        .setEmoji("🔆")
                        .setStyle(ButtonStyle.Success)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("MoonlightOn")
                        .setEmoji("🌕")
                        .setStyle(ButtonStyle.Primary)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("lightOff")
                        .setEmoji("🌑")
                        .setStyle(ButtonStyle.Secondary)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("Vapo10s")
                        .setEmoji("💧")
                        .setStyle(ButtonStyle.Primary)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("Orage")
                        .setEmoji("⛈️")
                        .setStyle(ButtonStyle.Primary)
                )

            message.channel.send({ embeds: [embed], components: [buttons] })
            break
        }
    }
})

client.on("interactionCreate", async (interaction) => {
    const interactionId = interaction.customId.split("_")[0];
    const arg = interaction.customId.split("_")[1];
    if (interaction.isButton()) {
        console.log(interactionId)
        switch (interactionId) {
            case "lightOn": {
                await interaction.deferUpdate();
                allumerLumiere()
                eteindreLumBleue()
                break
            }
            case "lightOff": {
                await interaction.deferUpdate();
                eteindreLumieres()
                break
            }
            case "Vapo10s": {
                await interaction.deferUpdate();
                vaporisations10s()
                break
            }
            case "MoonlightOn": {
                await interaction.deferUpdate();
                await eteindreLumiere()
                await allumerLumBleue()
                break
            }

            case "Orage": {
                await interaction.deferUpdate();
                // init de l'orage
                await eteindreLumiere()
                await allumerLumBleue()
                await wait(2000)

                // lancer la pluie
                await vapoON() // remove comment

                let orage = true

                setTimeout(() => {
                    vapoOFF()
                    // stop orage
                    orage = false
                }, 15000);

                while (orage) {
                    //gen num between 300 and 700
                    const time = Math.floor(Math.random() * (600 - 200 + 1) + 200)
                    console.log({ time })
                    await allumerLumiere()

                    await wait(time)
                    await eteindreLumiere()

                    const inter = Math.floor(Math.random() * (4000 - 2000 + 1) + 2000)
                    console.log({ inter })
                    await wait(inter)
                }

                // couper la pluie 
                // allumer la lumiere
                await wait(1000)
                await allumerLumiere()
                await eteindreLumBleue()
                break
            }

            default: {
                break;
            }
        }

    }
})


async function allumerLumiere() {
    var command = 'cm?cmnd=Power1%20On';
    var options = {
        url: `http://${config.ip}/${command}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    await request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
}

async function eteindreLumieres() {
    eteindreLumiere()
    eteindreLumBleue()
}

async function eteindreLumiere() {
    var command = 'cm?cmnd=Power1%20Off';
    var options = {
        url: `http://${config.ip}/${command}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    await request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
}

// eteindre toute la prise
async function eteindrePrise() {
    for (let i = 0; i < 5; i++) {
        var command = 'cm?cmnd=Power' + i + '%20Off';
        var options = {
            url: `http://${config.ip}/${command}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        await request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
            }
        });
    }
}

function vaporisations10s() {
    var command = 'cm?cmnd=Power' + 2 + '%20On';
    var options = {
        url: `http://${config.ip}/${command}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
    setTimeout(() => {
        var command = 'cm?cmnd=Power' + 2 + '%20Off';
        var options = {
            url: `http://${config.ip}/${command}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
            }
        });
    }, 10 * 1000);
}


function vapoON() {
    var command = 'cm?cmnd=Power' + 2 + '%20On';
    var options = {
        url: `http://${config.ip}/${command}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
}

function vapoOFF() {
    var command = 'cm?cmnd=Power' + 2 + '%20Off';
    var options = {
        url: `http://${config.ip}/${command}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
}


function allumerLumBleue() {
    var command = 'cm?cmnd=Power' + 3 + '%20On';
    var options = {
        url: `http://${config.ip}/${command}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
}

function eteindreLumBleue() {
    var command = 'cm?cmnd=Power' + 3 + '%20Off';
    var options = {
        url: `http://${config.ip}/${command}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    });
}



async function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


function genNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

async function plotingTempHum() {
    console.log("plotingTempHum")
    async function plot(data, color, data2, color2, labels) {
        const { ChartJSNodeCanvas } = require("chartjs-node-canvas");

        const width = 1000;
        const height = 500;
        const chartCallback = (ChartJS) => { };
        const canvas = new ChartJSNodeCanvas({ width, height }, chartCallback);
        // const configuration = {
        //     legend: { display: false },
        //     type: "line",
        //     data: {
        //         datasets: [{
        //             labels: data.date,
        //             data: data.data,
        //             backgroundColor: color,
        //             borderColor: color,
        //             cubicInterpolationMode: "monotone",
        //             borderWidth: 10
        //         },
        //         {
        //             labels: data2?.date,
        //             data: data2?.data,
        //             backgroundColor: color2,
        //             borderColor: color2,
        //             cubicInterpolationMode: "monotone",
        //             borderWidth: 10
        //         }
        //         ]
        //     },
        //     options: {
        //         scales: {
        //             y: {
        //                 ticks: {
        //                     color: "white",
        //                     font: {
        //                         size: 20
        //                     }
        //                 },
        //                 grid: {
        //                     borderColor: "rgba(0, 0, 0, 0)",
        //                     display: false,
        //                     drawborder: false
        //                 }
        //             },
        //             x: {
        //                 ticks: {
        //                     color: "white",
        //                     font: {
        //                         size: 10
        //                     }
        //                 },
        //                 grid: {
        //                     borderColor: "rgba(0, 0, 0, 0)",
        //                     display: false
        //                 }
        //             }
        //         },
        //         elements: {
        //             point: {
        //                 radius: 0
        //             }
        //         },
        //         plugins: {
        //             legend: {
        //                 display: false
        //             }
        //         }
        //     }
        // };

        const configuration = {
            legend: { display: false },
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    spanGaps: true,
                    backgroundColor: color,
                    borderColor: color,
                    cubicInterpolationMode: "monotone",
                    borderWidth: 10
                }, {
                    data: data2,
                    spanGaps: true,
                    backgroundColor: color2,
                    borderColor: color2,
                    cubicInterpolationMode: "monotone",
                    borderWidth: 10
                }]
            },
            options: {
                scales: {
                    y: {
                        ticks: {
                            color: "white",
                            font: {
                                size: 20
                            }
                        },
                        grid: {
                            borderColor: "rgba(0, 0, 0, 0)",
                            display: false,
                            drawborder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: "white",
                            font: {
                                size: 10
                            }
                        },
                        grid: {
                            borderColor: "rgba(0, 0, 0, 0)",
                            display: false
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 0
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        };

        const image = await canvas.renderToBuffer(configuration);
        const attachment = new AttachmentBuilder(image, "ping.png");
        return attachment;
    }
    const today = new Date()

    const files = fs.readdirSync('../zigbee2mqtt/data/log')
    // get last file in folder
    // const todayFiles = files.filter(file => file.includes(today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate()))
    // get most recent file
    const todayS = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate()
    // get most recent folder
    const todayFiles = files.filter(file => fs.readFileSync(`../zigbee2mqtt/data/log/${file}/log.txt`, 'utf8').includes(todayS))
    todayFiles.forEach(tfile => {
        fs.readFileSync(`../zigbee2mqtt/data/log/${tfile}/log.txt`, 'utf8').split(/\r?\n/).forEach(line => {
            if (line.includes('payload') && line.includes(todayS)) {
                // getting and logging datas
                try {
                    let data = line.split('payload')[1]
                    data = data.substring(1, data.length - 1).substring(1, data.length)
                    data = JSON.parse(data)
                    const id = line.split('zigbee2mqtt/')[1].split("',")[0]

                    if (data.humidity) {
                        const time = line.split(' ')[3]
                        const hour = time.split(':')[0]
                        const minute = time.split(':')[1]
                        const second = time.split(':')[2]


                        const fname = `./data/logs/${todayS}.json`
                        if (!fs.existsSync(fname)) {
                            fs.writeFileSync(fname, JSON.stringify({
                                "lastHumPLot": client.user.displayAvatarURL(),
                                "lastTempPLot": client.user.displayAvatarURL()
                            }))
                        }
                        // add data to json file
                        const json = require(fname)
                        data["device"] = id
                        json[hour + ':' + minute + ':' + second] = data
                        fs.writeFileSync(fname, JSON.stringify(json, null, 1), 'utf8', function (err) {
                            if (err) throw err;
                        })
                    }
                } catch (error) {
                    console.log(error)
                }
            }
        })
    });

    const storeChannel = await client.channels.fetch(config.plotChannel)


    // plot today data and send it in channel
    const path = `./data/logs/${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}.json`
    const todayData = require(path)

    const labels = []
    const humidityData = {
    }
    const temperatureData = {
    }

    // const humidityData = {
    //     date: [],
    //     data: []
    // }

    // const temperatureData = {
    //     date: [],
    //     data: []
    // }
    // get list of devices
    const devices = []
    for (const key in todayData) {
        if (todayData.hasOwnProperty(key)) {
            const element = todayData[key];
            if (!devices.includes(element.device)) {
                if (element?.device) {
                    devices.push(element.device)

                    humidityData[element.device] = []
                    temperatureData[element.device] = []
                }
            }
        }
    }
    Object.keys(todayData).forEach(time => {
        if (time.startsWith("last")) return
        const device = todayData[time].device
        const humidity = todayData[time].humidity
        const temperature = todayData[time].temperature
        humidityData[device].push(humidity)
        temperatureData[device].push(temperature)
        devices.forEach(devi => {
            if (devi != device) {
                humidityData[devi].push(null)
                temperatureData[devi].push(null)
            }
        })

        labels.push(time)
    })



    const controleChannel = await client.channels.fetch(config.controleChannel)

    const dataHum1 = humidityData[Object.keys(humidityData)[0]]
    const colorHum1 = "rgba(60, 99, 173, 1)"
    const dataHum2 = humidityData[Object.keys(humidityData)[1]]
    const colorHum2 = "rgba(108, 200, 249, 1)"


    await storeChannel.send({ files: [await plot(dataHum1, colorHum1, dataHum2, colorHum2, labels)] }).then(msg => {
        msg.attachments.map(att => {
            todayData.lastHumPLot = att.url;
        });
        fs.writeFileSync(path, JSON.stringify(todayData, null, 1), 'utf8', function (err) {
            if (err) throw err;
        })

    })


    const dataTemp1 = temperatureData[Object.keys(temperatureData)[0]]
    const colorTemp1 = "rgba(162, 57, 35 ,1)"
    const dataTemp2 = temperatureData[Object.keys(temperatureData)[1]]
    const colorTemp2 = "rgba(168, 81, 62, 1)"

    await storeChannel.send({ files: [await plot(dataTemp1, colorTemp1, dataTemp2, colorTemp2, labels)] }).then(msg => {
        msg.attachments.map(att => {
            todayData.lastTempPLot = att.url;
        });
        fs.writeFileSync(path, JSON.stringify(todayData, null, 1), 'utf8', function (err) {
            if (err) throw err;
        })
    })


    const humMessage = await controleChannel.messages.fetch(config.humControleMessage)
    const humEmbed = new EmbedBuilder()
        .setTitle("Humidité")
        .setColor("#3C63AD")
        .setImage(todayData.lastHumPLot)
        .setTimestamp();
    humMessage.edit({ embeds: [humEmbed] })


    const tempMessage = await controleChannel.messages.fetch(config.tempControleMessage)
    const tempEmbed = new EmbedBuilder()
        .setTitle("Température")
        .setColor("#A23923")
        .setTimestamp()
        .setImage(todayData.lastTempPLot);
    tempMessage.edit({ embeds: [tempEmbed] })


    // get last humidity and temperature data for each device
    const lastData = {}
    for (const key in todayData) {
        if (todayData.hasOwnProperty(key)) {
            const element = todayData[key];
            if (element.humidity) {
                if (!lastData[element.device]) {
                    lastData[element.device] = {
                        humidity: element.humidity,
                        temperature: element.temperature
                    }
                } else {
                    lastData[element.device].humidity = element.humidity
                    lastData[element.device].temperature = element.temperature
                }
            }
        }
    }

    // 0x00158d00033f09fa = "Point froid"
    // 0x00158d0008ce79dd = "Point chaud"

    const hotPoint = lastData["0x00158d0008ce79dd"]
    const coldPoint = lastData["0x00158d00033f09fa"]




    const embed = new EmbedBuilder()
        .setTitle("Controle du paludarium")
        .setColor("#a6d132")
        .addFields(
            { name: "Point Chaud", value: `${hotPoint.temperature} °C\n${hotPoint.humidity} %`, inline: true },
            { name: "Point Froid", value: `${coldPoint.temperature} °C\n${coldPoint.humidity} %`, inline: true },
        )
        .setTimestamp();
    const controlePannel = await controleChannel.messages.fetch(config.controlPannel)
    controlePannel.edit({ embeds: [embed] })
}