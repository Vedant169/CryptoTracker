import pandas as pd
from pycaret.classification import setup, compare_models, save_model

print("Loading dataset...")
# Kaggle ka data load kar rahe hain (Make sure CSV files same folder mein hon)
features = pd.read_csv('elliptic_bitcoin_dataset/elliptic_txs_features.csv', header=None)
classes = pd.read_csv('elliptic_bitcoin_dataset/elliptic_txs_classes.csv')

# Data merge aur clean karna
cols = ['txId'] + ['feat_' + str(i) for i in range(1, 167)]
features.columns = cols
dataset = pd.merge(features, classes, left_on='txId', right_on='txId', how='left')
dataset = dataset[dataset['class'] != 'unknown'] # Sirf known fraud/safe data rakho

print("Training ML Model (This might take a few minutes)...")
# PyCaret auto-training
setup(data = dataset, target = 'class', verbose=False)
best_model = compare_models(n_select=1) # Sabse best algorithm khud chulega

# Model save karna
save_model(best_model, 'crypto_fraud_model')
print("✅ Model trained and saved as 'crypto_fraud_model.pkl'")