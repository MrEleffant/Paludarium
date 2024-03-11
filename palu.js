require('dotenv').config()
var request = require('request');
const cron = require('cron');
const fs = require("fs");
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');

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

    // allumer la pompe et le chauffage par defaut, on pourra enlever le chauffage pendant l'été
    allumerEquipement(equipements.pompe)
    allumerEquipement(equipements.chauffage)

    // check if we are after 10am and before 10pm
    await wait(2000)
    const now = new Date()

    if (now.getHours() >= config.configuration.eclairage_jour.debut && now.getHours() < config.configuration.eclairage_jour.fin) {
        allumerEquipement(equipements.lumiere)
    } else if (now.getHours() >= config.configuration.eclairage_crepuscule.debut && now.getHours() < (config.configuration.eclairage_crepuscule.fin + 24)) {
        console.log("Crepuscule")
        allumerEquipement(equipements.lumiereBleue)
    } else {
        eteindreEquipement(equipements.lumiere)
        eteindreEquipement(equipements.lumiereBleue)
    }


    console.log("here")
    // lancement des automatismes
    let debutJour = new cron.CronJob(`00 ${config.configuration.eclairage_jour.debut} * * *`, () => {
        allumerEquipement(equipements.lumiere)
    });
    debutJour.start();

    let crepuscule = new cron.CronJob(`00 ${config.configuration.eclairage_jour.fin} * * *`, () => {
        allumerEquipement(equipements.lumiereBleue)
        eteindreEquipement(equipements.lumiere)
    });
    crepuscule.start();

    let nuit = new cron.CronJob(`00 ${config.configuration.eclairage_crepuscule.fin} * * *`, () => {
        eteindreEquipement(equipements.lumiere)
        eteindreEquipement(equipements.lumiereBleue)
    });
    nuit.start();


    for (const vapoSettings of config.configuration.vaporisation) {
        const { heure, minute, duree } = vapoSettings
        const cronTime = `${minute} ${heure} * * *`

        let vapo = new cron.CronJob(cronTime, () => { vaporisation(duree) });
        vapo.start();
    }

    for (const brumSettings of config.configuration.brumisation) {
        const { heure, minute, duree } = brumSettings
        const cronTime = `${minute} ${heure} * * *`

        let brum = new cron.CronJob(cronTime, () => { brumisation(duree) });
        brum.start();
    }

    for (const ventilSettings of config.configuration.ventilation) {
        const { heure, minute, duree } = ventilSettings
        const cronTime = `${minute} ${heure} * * *`

        let ventil = new cron.CronJob(cronTime, () => { ventilation(duree) });
        ventil.start();
    }

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

            switch (args[0]) {
                case "lum": {
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
                    break
                }

                case "vapo": {
                    const embedVapo = new EmbedBuilder()
                        .setTitle("Vaporisation")
                        .setColor("#a6d132")
                    const buttonsVapo = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("default_vaporisation")
                                .setEmoji("💧")
                                .setStyle(ButtonStyle.Primary)
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("default_brumisation")
                                .setEmoji("🌫️")
                                .setStyle(ButtonStyle.Primary)
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("brumisationOn")
                                .setEmoji("🟢")
                                .setStyle(ButtonStyle.Success)
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("brumisationOff")
                                .setEmoji("🔴")
                                .setStyle(ButtonStyle.Danger)
                        );

                    const vapoSelect = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId("vapoSelect")
                                .setPlaceholder("Choisissez un temps")
                                .addOptions(
                                    [
                                        {
                                            label: "5s",
                                            value: "5s",
                                        },
                                        {
                                            label: "10s",
                                            value: "10s",
                                        },
                                        {
                                            label: "15s",
                                            value: "15s",
                                        },
                                        {
                                            label: "20s",
                                            value: "20s",
                                        },
                                        {
                                            label: "25s",
                                            value: "25s",
                                        },
                                        {
                                            label: "30s",
                                            value: "30s",
                                        },
                                    ]
                                )
                        );

                    (await client.channels.fetch(config.channels.vaporisation)).send({ embeds: [embedVapo], components: [buttonsVapo, vapoSelect] })
                    break
                }

                case "autre": {
                    const embedPompe = new EmbedBuilder()
                        .setTitle("Pompe")
                        .setColor("#a6d132")
                    const buttonsPompe = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("Pompe_On")
                                .setEmoji("🟢")
                                .setStyle(ButtonStyle.Success)
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("Pompe_Off")
                                .setEmoji("🔴")
                                .setStyle(ButtonStyle.Danger)
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
                                .setStyle(ButtonStyle.Success)
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("Chauffage_Off")
                                .setEmoji("🔴")
                                .setStyle(ButtonStyle.Danger)
                        );
                    (await client.channels.fetch(config.channels.autre)).send({ embeds: [embedChauffage], components: [buttonsChauffage] })
                    break;
                }

                case "ventil": {
                    const embedVent = new EmbedBuilder()
                        .setTitle("Ventilation")
                        .setColor("#a6d132")
                    const buttonsVent = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("Ventil")
                                .setEmoji("🌬️")
                                .setStyle(ButtonStyle.Secondary)
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("VentilOn")
                                .setEmoji("🟢")
                                .setStyle(ButtonStyle.Success)
                        )
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId("VentilOff")
                                .setEmoji("🔴")
                                .setStyle(ButtonStyle.Danger)
                        );

                    // proposer select menu avec des temps allant de 1m à 25m
                    const ventilSelect = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId("ventilSelect")
                                .setPlaceholder("Choisissez un temps")
                                .addOptions(
                                    [
                                        {
                                            label: "5 minutes",
                                            value: "5m",
                                        },
                                        {
                                            label: "10 minutes",
                                            value: "10m",
                                        },
                                        {
                                            label: "15 minutes",
                                            value: "15m",
                                        },
                                        {
                                            label: "20 minutes",
                                            value: "20m",
                                        },
                                        {
                                            label: "25 minutes",
                                            value: "25m",
                                        },
                                        {
                                            label: "30 minutes",
                                            value: "30m",
                                        },
                                        {
                                            label: "35 minutes",
                                            value: "35m",
                                        },
                                        {
                                            label: "40 minutes",
                                            value: "40m",
                                        },
                                        {
                                            label: "45 minutes",
                                            value: "45m",
                                        },
                                        {
                                            label: "50 minutes",
                                            value: "50m",
                                        },
                                        {
                                            label: "55 minutes",
                                            value: "55m",
                                        },
                                        {
                                            label: "60 minutes",
                                            value: "60m",
                                        }
                                    ]
                                )
                        );

                    (await client.channels.fetch(config.channels.ventilation)).send({ embeds: [embedVent], components: [buttonsVent, ventilSelect] })

                    break;
                }

                default: {
                    break
                }
            }
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
            case "default_vaporisation": {
                await interaction.deferUpdate();
                vaporisations(config.configuration.default_vaporisation.duree)
                break
            }
            case "default_brumisation": {
                await interaction.deferUpdate();
                brumisation(config.configuration.default_brumisation.duree)
                break;
            }
            case "brumisationOn": {
                await interaction.deferUpdate();
                allumerEquipement(equipements.brumisation)
                break
            }
            case "brumisationOff": {
                await interaction.deferUpdate();
                eteindreEquipement(equipements.brumisation)
                break
            }
            case "MoonlightOn": {
                await interaction.deferUpdate();
                allumerEquipement(equipements.lumiereBleue)
                eteindreEquipement(equipements.lumiere)
                break
            }

            case "Ventil": {
                await interaction.deferUpdate();
                ventilation(config.configuration.default_ventilation.duree)

                break;
            }
            case "VentilOn": {
                await interaction.deferUpdate();
                allumerEquipement(equipements.VentilationIn)
                allumerEquipement(equipements.VentilationOut)
                break;
            }
            case "VentilOff": {
                await interaction.deferUpdate();
                eteindreEquipement(equipements.VentilationIn)
                eteindreEquipement(equipements.VentilationOut)
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

    } else if (interaction.isStringSelectMenu()) {
        console.log(interactionId)
        switch (interaction.customId) {
            case "ventilSelect": {
                await interaction.deferUpdate();
                const time = interaction.values[0].split("m")[0] * 60000
                allumerEquipement(equipements.VentilationIn)
                allumerEquipement(equipements.VentilationOut)
                setTimeout(() => {
                    eteindreEquipement(equipements.VentilationIn)
                    eteindreEquipement(equipements.VentilationOut)
                }, time);
                break;
            }
            case "vapoSelect": {
                await interaction.deferUpdate();
                const time = interaction.values[0].split("s")[0] * 1000
                allumerEquipement(equipements.vaporisation)
                setTimeout(() => {
                    eteindreEquipement(equipements.vaporisation)
                }, time);
                break;
            }

            default: {
                break;
            }
        }
    }
})

function vaporisation(sec) {
    allumerEquipement(equipements.vaporisation)
    setTimeout(() => {
        eteindreEquipement(equipements.vaporisation)
    }, sec * 1000);
}

function brumisation(min) {
    allumerEquipement(equipements.brumisation)
    setTimeout(() => {
        eteindreEquipement(equipements.brumisation)
    }, min * 1000 * 60);
}

async function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

async function ventilation(duree) {
    log("Renouvellement de l'air")
    allumerEquipement(equipements.VentilationIn)
    allumerEquipement(equipements.VentilationOut)
    await setTimeout(() => {
        eteindreEquipement(equipements.VentilationIn)
        eteindreEquipement(equipements.VentilationOut)
    }, duree * 1000 * 60);
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