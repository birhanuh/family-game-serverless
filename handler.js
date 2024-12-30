'use strict';

const AWS = require('aws-sdk');
const shortid = require('shortid');

module.exports.hello = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Go Serverless v1.0! Your function executed successfully!',
        input: event,
      },
      null,
      2
    ),
  };

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};

const dynamoDb = process.env.ENV === 'dev' ? new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000',
  }): new AWS.DynamoDB.DocumentClient();

// Get Games endpoint
module.exports.getGames = async (event) => {
  const scanParams = {
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Select: 'ALL_ATTRIBUTES',
    KeyConditions: {
      Status: {
        ComparisonOperator: 'EQ',
        AttributeValueList: ['OK'],
      },
    },
    ScanIndexForward: false,
  };

  const result = await dynamoDb.scan(scanParams).promise();

  if (result) {
    if (result.Items.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({error: 'Games not found' }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } else {
    console.log(result);
    return {
      statusCode: 404,
      body: JSON.stringify({error: 'Could not get games' }),
    };
  }

  // dynamoDb.scan(scanParams, (error, result) => {
  //   if (error) {
  //     console.log(error);
  //     return {
  //       statusCode: 404,
  //       body: JSON.stringify({error: 'Could not get games' }),
  //     }
  //   }
  //   if (result) {
  //   return JSON.statusCode(200).stringify(result);
  //     return {
  //       statusCode: 200,
  //       body: JSON.stringify(result),
  //     }
  //   } else {
  //     return {
  //       statusCode: 200,
  //       body: JSON.stringify({error: 'Games not found' }),
  //     }
  //   };
  // });
}

// Create Game endpoint
module.exports.createGame = async (event) => {
  const body = JSON.parse(event.body);
  
  const { title } = body;

  if (typeof title !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'title must be a string' }),
    }
  }

  const params = {
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Item: {
      gameId: shortid.generate(),
      title: title,
      questions: [],
      players: [],
      winner: {},
    },
  };

  const resultPost =  await dynamoDb.put(params).promise();

  if (resultPost) {
    return {
      statusCode: 201,
      body: JSON.stringify({ gameId: params.Item.gameId, winner: {}, title, players: [], questions: [] }),
    };
  } else {
    console.log(resultPost);
    return {
      statusCode: 404,
      body: JSON.stringify({error: 'Could not create game' }),
    };
  }

  // return dynamoDb.put(params, (error) => {
  //   if (error) {
  //     console.log(error);
  //     return {
  //       statusCode: 404,
  //       body: JSON.stringify({error: 'Could not create game' }),
  //     }
  //   };
  //   console.log('Log: ', params);
  //   return {
  //     statusCode: 201,
  //     body: JSON.stringify({ gameId: params.Item.gameId, winner: {}, title, players: [], questions: [] }),
  //   };
  // });
}

// Get Game endpoint
module.exports.getGame = async (event) => {
  const { gameId } = event.pathParameters;
  
  const params = {
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
  };

  const result = await dynamoDb.get(params).promise();
  
  if (!result) {
    console.log(result);
    return {
      statusCode: 404,
      body: JSON.stringify({error: 'Could not found' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };

  // dynamoDb.get(params, (error, result) => {
  //   if (error) {
  //     console.log(error);
  //     res.status(400).json({ error: 'Could not get game' });
  //   }
  //   if (result.Item) {
  //     res.json(result);
  //   } else {
  //     res.status(404).json({ error: 'Game not found' });
  //   }
  // });
}

// Update Game endpoint
module.exports.updateGame = async (event) => {
  const body = JSON.parse(event.body);
  
  const { gameId } = event.pathParameters;

  const { title, winner } = body;

  if (typeof title !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'title must be a string' }),
    }
  }

  const params = {
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId
    },
    UpdateExpression: 'SET title = :t, winner = :w',
    ExpressionAttributeValues: {
      ':t': title,
      ':w': winner,
    },
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamoDb.update(params).promise();

  if (!result) {
    console.log(result);
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Could not update game' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };

  // dynamoDb.update(params, (error, result) => {
  //   if (error) {
  //     console.log(error);
  //     res.status(400).json({ error: 'Could not update game' });
  //   }

  //   res.json(result);
  // });
}

// Reset Game endpoint
module.exports.resetGame = async (event) => {
  const { gameId } = event.pathParameters;

  const result = await dynamoDb.get({
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
  }).promise();

  // Reset players
  const playersReseted = result.Item.players.map((player) => {
    player.score = 0;

    return player;
  });

  // Reset questions
  const questionsReseted = result.Item.questions.map((question) => {
    question.isAsked = false;

    return question;
  });

  const params = {
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
    UpdateExpression: `SET winner = :w, players = :pls, questions = :qts`,
    ExpressionAttributeValues: {
      ':w': {},
      ':pls': playersReseted,
      ':qts': questionsReseted,
    },
    ReturnValues: 'ALL_NEW',
  };

  const resultUpdate = await dynamoDb.update(params).promise();

  if (!resultUpdate) {
    console.log(resultUpdate);
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Could not update game' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(resultUpdate),
  };

  // dynamoDb.update(params, (error, result) => {
  //   if (error) {
  //     console.log(error);
  //     res.status(400).json({ error: 'Could not update game' });
  //   }

  //   res.json(result);
  // });
}

// Delete Game endpoint
module.exports.deleteGame = async (event) => {
  const { gameId } = event.pathParameters;
  
  const params = {
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
  };

  const result = await dynamoDb.delete(params).promise();

  if (!result) {
    console.log(result);
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Could not delete game' }),
    };
  }

  return {
    statusCode: 200,
    body: 'Game is deleted!',
  };

  // dynamoDb.delete(params, (error) => {    
  //   if (error) {
  //     console.log(error);
  //     res.status(400).json({ error: 'Could not delete game' });
  //   }

  //   res.json(`Game is deleted!`);
  // });
}

/** QUESTION */
// Create Question endpoint
module.exports.createQuestion = async (event) => {
  const body = JSON.parse(event.body);
  
  const { gameId } = event.pathParameters;

  const { question } = body;

  if (typeof question !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({error: '"question" must be a string' }),
    }
  }

  // Short id
  const shortId = shortid.generate();

  const params = {
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
    ExpressionAttributeNames: {
      '#Y': 'questions',
    },
    UpdateExpression: 'SET #Y = list_append(#Y,:y)',
    ExpressionAttributeValues: {
      ':y': [{ questionId: shortId, question, isAsked: false }],
    },
  };
  
  const resultUpdate = await dynamoDb.update(params).promise();

  if (!resultUpdate) {
    console.log(resultUpdate);
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Could not create question' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ gameId, questionId: shortId, question, isAsked: false }),
  };

  // dynamoDb.update(params, (error) => {
  //   if (error) {
  //     console.log(error);
  //     res.status(400).json({ error: 'Could not create question' });
  //   }

  //   res.json({ gameId, questionId: shortId, question, isAsked: false });
  // });
}

// Update Question endpoint
module.exports.updateQuestion = async (event) => {
  const body = JSON.parse(event.body);
  
  const { gameId, questionId } = event.pathParameters;

  const { question, isAsked } = body;

  if (typeof question !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({error: '"question" must be a string' }),
    }
  }

  if (typeof isAsked !== 'boolean') {
    return {
      statusCode: 400,
      body: JSON.stringify({error: '"isAsked" must be a boolean' }),
    }
  }

  const result = await dynamoDb.get({
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
  }).promise();

  // find the index
  const indexToUpdate = findWithAttr(result.Item.questions, 'questionId', questionId);
  if (indexToUpdate === -1) {
    // element not found
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Question not found' }),
    }
  }

  const params = {
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
    UpdateExpression: `SET questions[${indexToUpdate}] = :valueToUpdate`,
    ExpressionAttributeValues: {
      ':valueToUpdate': { questionId, question, isAsked },
    },
  };

  const resultUpdate = await dynamoDb.update(params).promise();

  if (!resultUpdate) {
    console.log(resultUpdate);
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Could not update question' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ gameId, questionId, question, isAsked }),
  };

  // dynamoDb.update(params, (error) => {
  //   if (error) {
  //     console.log(error);
  //     res.status(400).json({ error: 'Could not update question' });
  //   }
 
  //   res.json({ gameId, questionId: questionId, question, isAsked });
  // });
}

// Delete Question endpoint
module.exports.deleteQuestion = async (event) => {  
  const { gameId, questionId } = event.pathParameters;

  const result = await dynamoDb.get({
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
  }).promise();

  // find the index
  const indexToRemove = findWithAttr(result.Item.questions, 'questionId', questionId);

  console.log('Delete question: ', result.Item, event.pathParameters, indexToRemove);

  if (indexToRemove === -1) {
    // element not found
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Question not found' }),
    };
  } else {
    const params = {
      TableName: process.env.DYNAMODB_GAME_TABLE,
      Key: {
        gameId,
      },
      UpdateExpression: `REMOVE questions[${indexToRemove}]`,
    };

    const resultUpdate = await dynamoDb.update(params).promise();

    if (!resultUpdate) {
      console.log(resultUpdate);
      return {
        statusCode: 400,
        body: JSON.stringify({error: 'Could not delete question' }),
      };
    }
  
    return {
      statusCode: 200,
      body: JSON.stringify({ gameId, questionId }),
    };

    // dynamoDb.update(params, (error) => {
    //   if (error) {
    //     console.log(error);
    //     res.status(400).json({ error: 'Could not delete question' });
    //   }

    //   res.json({ gameId, questionId });
    // });
  }
}

/** PLAYER */
// Create Player endpoint
module.exports.createPlayer = async (event) => {
  const body = JSON.parse(event.body);
  
  const { gameId } = event.pathParameters;

  const { name } = body;

  if (typeof name !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Could not update question' }),
    };
  }

  '"isAsked" must be a boolean'
  // Short id
  const shortId = shortid.generate();

  const params = {
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
    ExpressionAttributeNames: {
      '#Y': 'players',
    },
    UpdateExpression: 'SET #Y = list_append(#Y,:y)',
    ExpressionAttributeValues: {
      ':y': [{ playerId: shortId, name, score: 0 }],
    },
  };

  const resultUpdate = await dynamoDb.update(params).promise();

  if (!resultUpdate) {
    console.log(resultUpdate);
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Could not update player' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ gameId, playerId: shortId, name, score: 0 }),
  };

  // dynamoDb.update(params, (error) => {
  //   if (error) {
  //     console.log(error);
  //     res.status(400).json({ error: 'Could not create player' });
  //   }

  //   res.json({ gameId, playerId: shortId, name, score: 0 });
  // });
}

// Update Player endpoint
module.exports.updatePlayer = async (event) => {
  const body = JSON.parse(event.body);
  
  const { gameId, playerId } = event.pathParameters;

  const { name, score } = body;

  if (typeof name !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({error: '"name" must be a string' }),
    }
  }

  if (typeof score !== 'number') {
    return {
      statusCode: 400,
      body: JSON.stringify({error: '"score" must be a number' }),
    }
  }

  const result = await dynamoDb.get({
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
  }).promise();

  // find the index
  const indexToUpdate = findWithAttr(result.Item.players, 'playerId', playerId);
  if (indexToUpdate === -1) {
    // element not found
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Player not found' }),
    }
  } else {
    const params = {
      TableName: process.env.DYNAMODB_GAME_TABLE,
      Key: {
        gameId,
      },
      UpdateExpression: `SET players[${indexToUpdate}] = :valueToUpdate`,
      ExpressionAttributeValues: {
        ':valueToUpdate': { playerId, name, score },
      },
    };

    const resultUpdate = await dynamoDb.update(params).promise();

    if (!resultUpdate) {
      console.log(resultUpdate);
      return {
        statusCode: 400,
        body: JSON.stringify({error: 'Could not update player' }),
      };
    }
  
    return {
      statusCode: 200,
      body: JSON.stringify({ gameId, playerId, name, score }),
    };

    // dynamoDb.update(params, (error) => {
    //   if (error) {
    //     console.log(error);
    //     res.status(400).json({ error: 'Could not update player' });
    //   }

    //   res.json({ gameId, playerId: playerId, name, score });
    // });
  }
}

// Delete Player endpoint
module.exports.deletePlayer = async (event) => {  
  const { gameId, playerId } = event.pathParameters;

  const result = await dynamoDb.get({
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
  }).promise();

  // find the index
  const indexToRemove = findWithAttr(result.Item.players, 'playerId', playerId);
  if (indexToRemove === -1) {
    // element not found
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Player not found' }),
    };
  }

  const params = {
    TableName: process.env.DYNAMODB_GAME_TABLE,
    Key: {
      gameId,
    },
    UpdateExpression: `REMOVE players[${indexToRemove}]`,
  };

  const resultUpdate = await dynamoDb.update(params).promise();

  if (!resultUpdate) {
    console.log(resultUpdate);
    return {
      statusCode: 400,
      body: JSON.stringify({error: 'Could not delete player' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ gameId, playerId }),
  };

  // dynamoDb.update(params, (error) => {
  //   if (error) {
  //     console.log(error);
  //     res.status(400).json({ error: 'Could not delete player' });
  //   }

  //   res.json({ gameId, playerId });
  // });
}

function findWithAttr(array, attr, value) {
  for (var i = 0; i < array.length; i += 1) {
    if (array[i][attr] === value) {
      return i;
    }
  }
  return -1;
}