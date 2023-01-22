require('dotenv').config()
var request = require('request');
const cron = require('cron');
const fs = require("fs");
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, SelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ], partials: [Partials.Channel]
});

let guild, logChannel
const config = require("./config/config.json");
const equipements = require("./config/equipements.json");

client.login(process.env.TOKEN);

client.on("ready", async () => {
    guild = await client.guilds.fetch(config.guild)
    logChannel = await guild.channels.fetch(config.logChannel)

    console.log(`${client.user.tag} is ready!`)
    log("Bot démarré")


    // eteindre tous les equipements
    for (const eqpt in equipements) {
        console.log(`Eteindre ${eqpt}`)
        eteindreEquipement(equipements[eqpt])
    }

    await wait(2000)

    // allumer la pompe et le chauffage 
    allumerEquipement(equipements.pompe)
    allumerEquipement(equipements.chauffage)

    // check if we are after 10am and before 10pm
    await wait(2000)
    const now = new Date()
    console.log(now.getHours() >= config.heures.crepuscule.debut)
    console.log(now.getHours() < config.heures.crepuscule.fin)
    if (now.getHours() >= config.heures.jour.debut && now.getHours() < config.heures.jour.fin) {
        allumerEquipement(equipements.lumiere)
    } else if (now.getHours() >= config.heures.crepuscule.debut && now.getHours() < (config.heures.crepuscule.fin + 24)) {
        console.log("Crepuscule")
        allumerEquipement(equipements.lumiereBleue)
    } else {
        eteindreEquipement(equipements.lumiere)
        eteindreEquipement(equipements.lumiereBleue)
    }

    let debutJour = new cron.CronJob(`00 ${config.heures.jour.debut} * * *`, () => {
        allumerEquipement(equipements.lumiere)
    });
    debutJour.start();

    let crepuscule = new cron.CronJob(`00 ${config.heures.jour.fin} * * *`, () => {
        allumerEquipement(equipements.lumiereBleue)
        eteindreEquipement(equipements.lumiere)
    });
    crepuscule.start();


    let nuit = new cron.CronJob(`00 ${config.heures.crepuscule.fin} * * *`, () => {
        eteindreEquipement(equipements.lumiere)
        eteindreEquipement(equipements.lumiereBleue)
    });
    nuit.start();

    let vapo = new cron.CronJob(`00  ${config.heures.vapo.debut}-${config.heures.vapo.fin}/${config.heures.vapo.ratio} * * *`, vaporisations);
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

            // controle des stats
            const buttonsPlot = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("refreshPlot")
                        .setEmoji("🔄")
                        .setStyle(ButtonStyle.Primary)
                )

            const humEmbed = new EmbedBuilder()
                .setTitle("Humidité")
                .setColor("#3C63AD")
                .setTimestamp()
            const tempEmbed = new EmbedBuilder()
                .setTitle("Température")
                .setColor("#A23923")
                .setTimestamp()
            const humMessage = await message.channel.send({ embeds: [humEmbed] })
            const tempMessage = await message.channel.send({ embeds: [tempEmbed] })


            const embed = new EmbedBuilder()
                .setTitle("Controle du paludarium")
                .setColor("#a6d132")

            const controlMessage = await message.channel.send({ embeds: [embed], components: [buttonsPlot] })

            // save messages id in config
            config.humControleMessage = humMessage.id
            config.tempControleMessage = tempMessage.id
            config.controlPannel = controlMessage.id

            fs.writeFile("./config/config.json", JSON.stringify(config, null, 4), (err) => {
                if (err) throw err;
                console.log("The file has been saved!");
            });

            // controle de la lumière
            const embedLumiere = new EmbedBuilder()
                .setTitle("Lumière")
                .setColor("#a6d132")
            const buttonsLumiere = new ActionRowBuilder()
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
                );
            (await client.channels.fetch(config.channels.lumieres)).send({ embeds: [embedLumiere], components: [buttonsLumiere] })

            // controle de la vaporisation
            const embedVapo = new EmbedBuilder()
                .setTitle("Vaporisation")
                .setColor("#a6d132")
            const buttonsVapo = new ActionRowBuilder()
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
                );
            (await client.channels.fetch(config.channels.vaporisation)).send({ embeds: [embedVapo], components: [buttonsVapo] })


            // controle de la ventilation
            const embedVent = new EmbedBuilder()
                .setTitle("Ventilation")
                .setColor("#a6d132")
            const buttonsVent = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("Ventil")
                        .setEmoji("🌬️")
                        .setStyle(ButtonStyle.Secondary)
                );
            (await client.channels.fetch(config.channels.ventilation)).send({ embeds: [embedVent], components: [buttonsVent] })

            // controle autres
            // pompe
            const embedPompe = new EmbedBuilder()
                .setTitle("Pompe")
                .setColor("#a6d132")
            const buttonsPompe = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("Pompe_On")
                        .setEmoji("🟢")
                        .setStyle(ButtonStyle.Primary)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("Pompe_Off")
                        .setEmoji("🔴")
                        .setStyle(ButtonStyle.Secondary)
                );
            (await client.channels.fetch(config.channels.autre)).send({ embeds: [embedPompe], components: [buttonsPompe] })


            // chauffage
            const embedChauffage = new EmbedBuilder()
                .setTitle("Chauffage")
                .setColor("#a6d132")
            const buttonsChauffage = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("Chauffage_On")
                        .setEmoji("🟢")
                        .setStyle(ButtonStyle.Primary)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("Chauffage_Off")
                        .setEmoji("🔴")
                        .setStyle(ButtonStyle.Secondary)
                );
            (await client.channels.fetch(config.channels.autre)).send({ embeds: [embedChauffage], components: [buttonsChauffage] })

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
                allumerEquipement(equipements.lumiere)
                eteindreEquipement(equipements.lumiereBleue)
                break
            }
            case "lightOff": {
                await interaction.deferUpdate();
                eteindreEquipement(equipements.lumiere)
                eteindreEquipement(equipements.lumiereBleue)
                break
            }
            case "Vapo10s": {
                await interaction.deferUpdate();
                vaporisations()
                break
            }
            case "MoonlightOn": {
                await interaction.deferUpdate();
                allumerEquipement(equipements.lumiereBleue)
                eteindreEquipement(equipements.lumiere)
                break
            }

            case "Orage": {
                await interaction.deferUpdate();
                // init de l'orage
                eteindreEquipement(equipements.lumiere)
                allumerEquipement(equipements.lumiereBleue)

                await wait(2000)

                // lancer la pluie
                allumerEquipement(equipements.vaporisation)

                let orage = true

                setTimeout(() => {
                    eteindreEquipement(equipements.vaporisation)
                    // stop orage
                    orage = false
                }, config.heures.vapo.duree * 1000);

                while (orage) {
                    //gen num between 300 and 700
                    const time = Math.floor(Math.random() * (600 - 200 + 1) + 200)
                    console.log({ time })
                    allumerEquipement(equipements.lumiere)

                    await wait(time)
                    eteindreEquipement(equipements.lumiere)

                    const inter = Math.floor(Math.random() * (4000 - 2000 + 1) + 2000)
                    await wait(inter)
                }

                // couper la pluie 
                // allumer la lumiere
                await wait(1000)
                allumerEquipement(equipements.lumiere)
                eteindreEquipement(equipements.lumiereBleue)
                break
            }

            case "Ventil": {
                await interaction.deferUpdate();
                allumerEquipement(equipements.VentilationIn)
                allumerEquipement(equipements.VentilationOut)
                setTimeout(() => {
                    eteindreEquipement(equipements.VentilationIn)
                    eteindreEquipement(equipements.VentilationOut)
                }, config.heures.ventil.duree * 1000);

                break;
            }
            case "refreshPlot": {
                await interaction.deferUpdate();
                plotingTempHum()
                break;
            }

            case "Pompe": {
                await interaction.deferUpdate();
                if (arg === "On") {
                    allumerEquipement(equipements.pompe)
                } else {
                    eteindreEquipement(equipements.pompe)
                }
                break;
            }

            case "Chauffage": {
                await interaction.deferUpdate();
                if (arg === "On") {
                    allumerEquipement(equipements.chauffage)
                } else {
                    eteindreEquipement(equipements.chauffage)
                }
                break;
            }

            default: {
                break;
            }
        }

    } else if (interaction.isSelectMenu()) {
        console.log(interactionId)
        switch (interaction.customId) {
            case "tempPlot": {
                const value = interaction.values[0]
                const oldLog = require(`./data/logs/${value}`)
                const tempEmbed = new EmbedBuilder()
                    .setTitle("Température")
                    .setColor("#A23923")
                    .setFooter({ text: `Log du ${value.split(".")[0]}` })
                    .setImage(oldLog.lastTempPLot);
                interaction.reply({ embeds: [tempEmbed], ephemeral: true })
                break
            }
            case "humPlot": {
                const value = interaction.values[0]
                const oldLog = require(`./data/logs/${value}`)
                const humEmbed = new EmbedBuilder()
                    .setTitle("Humidité")
                    .setColor("#3C63AD")
                    .setFooter({ text: `Log du ${value.split(".")[0]}` })
                    .setImage(oldLog.lastHumPLot);
                interaction.reply({ embeds: [humEmbed], ephemeral: true })
                break
            }
            default: {
                break;
            }
        }
    }
})

function vaporisations() {
    allumerEquipement(equipements.vaporisation)
    setTimeout(() => {
        eteindreEquipement(equipements.vaporisation)
    }, config.heures.vapo.duree * 1000);
}

async function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

async function plotingTempHum() {
    log("Actualisation des graphiques")

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
    const todayS = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2)
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

    const date = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2)
    const path = `./data/logs/${date}.json`
    if (!fs.existsSync(path)) {
        console.log("no data for today")
        return
    }
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



    const hotDevice = "0x00158d00033f09fa"
    const coldDevice = "0x00158d0008cf23c5"
    const controleChannel = await client.channels.fetch(config.controleChannel)


    const dataHum1 = humidityData[hotDevice]
    const dataHum2 = humidityData[coldDevice]
    // const color1 = "rgba(69, 123, 157, 1)"
    // const color2 = "rgba(241, 250, 238, 1)"
    const color1 = "rgba(162, 57, 35, 1)"
    const color2 = "rgba(60, 99, 173, 1)"


    await storeChannel.send({ files: [await plot(dataHum1, color1, dataHum2, color2, labels)] }).then(msg => {
        msg.attachments.map(att => {
            todayData.lastHumPLot = att.url;
        });
        fs.writeFileSync(path, JSON.stringify(todayData, null, 1), 'utf8', function (err) {
            if (err) throw err;
        })

    })


    const dataTemp1 = temperatureData[hotDevice]
    const dataTemp2 = temperatureData[coldDevice]

    await storeChannel.send({ files: [await plot(dataTemp1, color1, dataTemp2, color2, labels)] }).then(msg => {
        msg.attachments.map(att => {
            todayData.lastTempPLot = att.url;
        });
        fs.writeFileSync(path, JSON.stringify(todayData, null, 1), 'utf8', function (err) {
            if (err) throw err;
        })
    })

    const f = fs.readdirSync('./data/logs')
    const recentFiles = f.slice(Math.max(files.length - 26, 0))
    let logList = []
    recentFiles.forEach(file => {
        logList.push({
            label: file.split(".")[0],
            value: file
        })
    })
    if (logList.length > 25) {
        logList = logList.slice(Math.max(logList.length - 25, 0))
    }

    logList = logList.reverse()


    const humPlot = new ActionRowBuilder()
        .addComponents(
            new SelectMenuBuilder()
                .setCustomId("humPlot")
                .setPlaceholder("Autres logs")
                .addOptions(logList)
        );
    const tempPlot = new ActionRowBuilder()
        .addComponents(
            new SelectMenuBuilder()
                .setCustomId("tempPlot")
                .setPlaceholder("Autres logs")
                .addOptions(logList)
        );



    const humMessage = await controleChannel.messages.fetch(config.humControleMessage)
    const humEmbed = new EmbedBuilder()
        .setTitle("Humidité")
        .setColor("#3C63AD")
        .setImage(todayData.lastHumPLot)
        .setTimestamp();
    humMessage.edit({ embeds: [humEmbed], components: [humPlot] })


    const tempMessage = await controleChannel.messages.fetch(config.tempControleMessage)
    const tempEmbed = new EmbedBuilder()
        .setTitle("Température")
        .setColor("#A23923")
        .setTimestamp()
        .setImage(todayData.lastTempPLot);
    tempMessage.edit({ embeds: [tempEmbed], components: [tempPlot] })




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

    const hotPoint = lastData[hotDevice]
    const coldPoint = lastData[coldDevice]

    const embed = new EmbedBuilder()
        .setTitle("Controle du paludarium")
        .setColor("#a6d132")
        .addFields(
            { name: "Point Chaud", value: `${hotPoint?.temperature || "-"} °C\n${hotPoint?.humidity || "-"} %`, inline: true },
            { name: "Point Froid", value: `${coldPoint?.temperature || "-"} °C\n${coldPoint?.humidity || "-"} %`, inline: true },
        )
        .setTimestamp();
    const controlePannel = await controleChannel.messages.fetch(config.controlPannel)
    controlePannel.edit({ embeds: [embed] })
}

function log(text) {
    logChannel.send(`[${new Date().toLocaleString()}] ${text}`)
}

async function allumerEquipement(eqpt) {
    const prise = eqpt.prise
    const inter = eqpt.inter

    log(`Equipement : ${eqpt.name} - ON`)

    var command = 'cm?cmnd=Power' + inter + '%20On';
    var options = {
        url: `http://192.168.1.${prise}/${command}`,
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

async function eteindreEquipement(eqpt) {
    const prise = eqpt.prise
    const inter = eqpt.inter

    log(`Equipement : ${eqpt.name} - OFF`)

    var command = 'cm?cmnd=Power' + inter + '%20Off';
    var options = {
        url: `http://192.168.1.${prise}/${command}`,
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