
try {
    const { mathCommands } = require('./src/commands/Math Game/math');
    console.log('Successfully loaded mathCommands');
    console.log(JSON.stringify(mathCommands[0].toJSON(), null, 2));
} catch (error) {
    console.error('Error loading mathCommands:', error);
}
