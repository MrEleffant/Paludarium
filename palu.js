require('dotenv').config()
var request = require('request');
const cron = require('cron');
const fs = require("fs");
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ], partials: [Partials.Channel]
});

let guild
const config = require("./config/config.json")

client.login(process.env.TOKEN);

client.on("ready", async () => {
    guild = await client.guilds.fetch(config.guild)
    console.log(`${client.user.tag} is ready!`)
    await eteindrePrise()
    await wait(2000)
    // check if we are after 10am and before 10pm
    const now = new Date()
    console.log(now.getHours())
    if (now.getHours() >= 10 && now.getHours() < 22) {
        allumerLumiere()
    } else if (now.getHours() >= 22 && now.getHours() < 23) {
        allumerLumBleue()
    } else {
        eteindreLumieres()
    }

    let debutJour = new cron.CronJob(`00 10 * * *`, allumerLumiere);
    debutJour.start();
    let finJour = new cron.CronJob(`00 22 * * *`, () => {
        allumerLumBleue()
        eteindreLumiere()
    });
    finJour.start();


    let nuit = new cron.CronJob(`00 23 * * *`, eteindreLumieres);
    nuit.start();

    let vapo = new cron.CronJob(`00  10-22/2 * * *`, vaporisations10s);
    vapo.start();

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
                    console.log({time})
                    await allumerLumiere()

                    await wait(time)
                    await eteindreLumiere()

                    const inter = Math.floor(Math.random() * (5000 - 2000 + 1) + 2000)
                    console.log({inter})
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