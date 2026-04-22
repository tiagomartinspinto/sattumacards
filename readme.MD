# Sattuma

Sattuma is a collaborative digital and physical card game for imagining, discussing, and reshaping teaching situations. The game uses six card decks, each contributing one part of a shared scenario: situation, space, methods and insights, resources, teaching format, and chance.

The digital version is designed for shared online play. Players can join the same room from different computers or tablets, see the same table state in real time, and discuss the cards together in local, remote, or hybrid settings.

This repository contains the source code for the digital version of Sattuma, including the Node.js server, browser client, localized card content, interface translations, and project checks.

## Project Background

Sattuma was developed as part of the Taiteet ja digi project, funded by the Finnish Ministry of Education and Culture for 2021-2023. It is a collaboration between Uniarts Helsinki and Aalto University.

The game was designed by Tomi Slotte Dufva, Senior University Lecturer at the Aalto University School of Arts, Design and Architecture, and Professors Mikael Brygger and Tomi Humalisto from the Theatre Academy of Uniarts Helsinki. The physical cards, graphic design, and digital implementation were created by Tiago Martins Pinto from Aalto University.

The broader project also includes participation from the University of Helsinki, Tampere University, the University of Turku, and Häme University of Applied Sciences. A physical set of cardboard Sattuma cards has also been produced and can be inquired about from the creators.

## Running Locally

There is currently no confirmed public production URL for the digital game. The previous README referred to `https://www.sattuma.com`, but that address is no longer used by this project.

For development or testing, run the game locally:

```bash
npm install
npm start
```

Then open:

```text
http://localhost:4000
```

When the project is deployed to a live server, shared room links will use that deployed domain automatically.

## How The Game Works

Players build an imagined teaching situation by placing one card from each of the six decks onto the table. Once all six cards are visible, the group discusses what kind of learning event the cards describe.

The digital game supports two main ways to begin:

1. Drag cards manually from the decks onto the table.
2. Press the Sattuma logo button to deal a random six-card situation automatically.

After the initial situation is built, Game A continues through discussion and replacement rounds. In a replacement round, the active player replaces one table card with a new card from the same deck, turns it over, and the group discusses how the scenario changes.

The Start over button clears the table, shuffles the cards, and returns the room to the beginning of a new round.

## Online Rooms

Each browser session joins a game room. Players in the same room share the same table state, including cards, flipped cards, turns, timer state, and replacements.

Use the Copy room link button to invite others. The copied link includes the room code, so another player can open it and join the same session directly.

Room state is kept in server memory. This means rooms are temporary and reset if the server restarts.

## Features

- Real-time multiplayer rooms with Socket.IO.
- Shareable room links.
- Finnish and English interface, rules, card texts, and content.
- Guided Game A flow with deal, discussion, and replacement phases.
- Optional discussion timer.
- Random six-card deal via the Sattuma logo button.
- Start over control for clearing the table and beginning again.
- Animated card dealing, shuffling, flipping, and replacement.
- Responsive handling for desktop and larger landscape tablet screens.
- Informational mobile view for screens that are too small for comfortable play.
- Theme/background selector with contrast-aware labels and controls.
- Formatted modal content for instructions, project information, and contacts.

## Project Structure

```text
server.js                  Express and Socket.IO server
public/index.html          Main game interface
public/gameA.css           Game styling and responsive layout
public/js/                 Client-side modules
public/i18n/               Interface translations
public/content/            Localized modal content
public/cards/              Localized deck text files
public/imgs/               Logos and interface images
public/front_card_img/     Card front images
public/back_card_imgs/     Card back image
scripts/                   Local validation scripts
```

## Development

Install dependencies:

```bash
npm install
```

Start the local server:

```bash
npm start
```

Run validation checks:

```bash
npm run check
```

The check command validates the server syntax, client module syntax, deck parity, and a smoke test.

## Deployment Notes

The app is a Node.js server using Express and Socket.IO. It should be deployed somewhere that supports persistent Node processes and WebSocket connections.

Because room state is currently stored in memory, a production deployment should be treated as session-based. If the server restarts, active rooms are lost. For long-lived rooms or multi-instance hosting, the room state would need to be moved to shared storage.

## Contributing

Contributions are welcome. A typical contribution flow is:

1. Fork the repository.
2. Create a feature branch.
3. Make a focused change.
4. Run `npm run check`.
5. Open a pull request.

## License

This game is distributed under the MIT License. See the `LICENSE` file for more information.

## Contact

- Tomi Slotte Dufva: [tomi.slottedufva@aalto.fi](mailto:tomi.slottedufva@aalto.fi)
- Mikael Brygger: [mikael.brygger@uniarts.fi](mailto:mikael.brygger@uniarts.fi)
- Tomi Humalisto: [tomi.humalisto@uniarts.fi](mailto:tomi.humalisto@uniarts.fi)
- Tiago Martins Pinto: [tiago.martins@aalto.fi](mailto:tiago.martins@aalto.fi)

Repository: [https://github.com/tiagomartinspinto/sattumacards](https://github.com/tiagomartinspinto/sattumacards)

Tiago Martins Pinto: [https://www.tiagomartinspinto.com](https://www.tiagomartinspinto.com)

## Acknowledgements

This project was made possible through the collaboration of:

- Uniarts Helsinki
- Aalto University
- University of Helsinki
- Tampere University
- University of Turku
- Häme University of Applied Sciences
- The Finnish Ministry of Education and Culture
