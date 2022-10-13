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
    eteindrePrise()
    // check if we are after 10am and before 10pm
    const now = new Date()
    console.log(now.getHours())
    if (now.getHours() >= 10 && now.getHours() < 23) {
        allumerLumiere()
    } else {
        eteindreLumiere()
    }



    // cron eveery minute on sunday 
    let debutJour = new cron.CronJob(`00 10 * * *`, allumerLumiere);
    debutJour.start();
    let finJour = new cron.CronJob(`00 23 * * *`, eteindreLumiere);
    finJour.start();

    let vapo = new cron.CronJob(`00  10-22/2 * * *`, vaporisations);
    vapo.start();

})

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.channel.type === "dm") return;
    const args = message.content.substring(config.prefix.length).trim().split(" ");
    const command = args.shift().toLowerCase();
    if (!message.content.startsWith(config.prefix)) return;
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
                        .setLabel("Allumer Lumière")
                        .setStyle(ButtonStyle.Success)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("lightOff")
                        .setLabel("Eteindre Lumière")
                        .setStyle(ButtonStyle.Danger)
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("Vapo10s")
                        .setLabel("Vaporisation 10s")
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
        switch (interactionId) {
            case "lightOn": {
                await interaction.deferUpdate();
                allumerLumiere()
                break
            }
            case "lightOff": {
                await interaction.deferUpdate();
                eteindreLumiere()
                break
            }
            case "Vapo10s": {
                await interaction.deferUpdate();
                vaporisations()
                break
            }

            default: {
                break;
            }
        }

    }
})


function allumerLumiere() {
    var command = 'cm?cmnd=Power1%20On';
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
function eteindreLumiere() {
    var command = 'cm?cmnd=Power1%20Off';
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

// eteindre toute la prise
function eteindrePrise() {
    for (let i = 0; i < 5; i++) {
        var command = 'cm?cmnd=Power' + i + '%20Off';
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
}

function vaporisations() {
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
