import * as tf from '@tensorflow/tfjs';

console.log('🧠 Testing TensorFlow.js with Apple Silicon...');

async function testTensorFlow() {
    try {
        // Check available backends
        console.log('Available backends:', tf.getBackend());
        
        // Test basic tensor operations
        console.log('🔢 Testing basic tensor operations...');
        
        // Create tensors
        const tensor1 = tf.tensor2d([[1, 2], [3, 4]]);
        const tensor2 = tf.tensor2d([[5, 6], [7, 8]]);
        
        console.log('Tensor 1:', tensor1.arraySync());
        console.log('Tensor 2:', tensor2.arraySync());
        
        // Perform operations
        const sum = tensor1.add(tensor2);
        const product = tensor1.mul(tensor2);
        const matrixProduct = tensor1.matMul(tensor2);
        
        console.log('Sum:', sum.arraySync());
        console.log('Product:', product.arraySync());
        console.log('Matrix Product:', matrixProduct.arraySync());
        
        // Test neural network creation
        console.log('🧠 Testing neural network creation...');
        
        const model = tf.sequential();
        model.add(tf.layers.dense({
            units: 10,
            inputShape: [5],
            activation: 'relu'
        }));
        model.add(tf.layers.dense({
            units: 1,
            activation: 'linear'
        }));
        
        model.compile({
            optimizer: 'adam',
            loss: 'meanSquaredError'
        });
        
        console.log('Model created successfully');
        console.log('Model summary:');
        model.summary();
        
        // Test training with synthetic data
        console.log('🎯 Testing model training...');
        
        const xs = tf.randomNormal([100, 5]);
        const ys = tf.randomNormal([100, 1]);
        
        const history = await model.fit(xs, ys, {
            epochs: 5,
            batchSize: 32,
            verbose: 1
        });
        
        console.log('Training completed successfully');
        console.log('Training loss:', history.history.loss);
        
        // Test prediction
        console.log('🔮 Testing prediction...');
        const testInput = tf.randomNormal([1, 5]);
        const prediction = model.predict(testInput) as tf.Tensor;
        
        console.log('Test input:', testInput.arraySync());
        console.log('Prediction:', prediction.arraySync());
        
        // Memory cleanup
        tf.dispose([tensor1, tensor2, sum, product, matrixProduct, xs, ys, testInput, prediction]);
        
        console.log('All TensorFlow.js tests passed!');
        console.log('🍎 Apple Silicon + TensorFlow.js + TypeScript is working perfectly!');
        
    } catch (error) {
        console.error('TensorFlow.js test failed:', error);
    }
}

// Run the test
testTensorFlow().catch(console.error); 