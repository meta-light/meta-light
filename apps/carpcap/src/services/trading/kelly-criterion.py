
import numpy as np
import matplotlib.pyplot as plt
from typing import List, Tuple

def kelly_criterion_newton(odds: List[float], probabilities: List[float], 
                         initial_value: float = 0.25, threshold: float = 1e-6) -> Tuple[float, float]:
    """
    Calculate optimal Kelly Criterion fraction using Newton's method for multiple outcomes.
    """
    b = np.array(odds)
    p = np.array(probabilities)
    
    # Normalize probabilities
    p = p / np.sum(p)
    
    # Check if profitable
    if np.sum(b * p) <= 0:
        return 0.0, 0.0
    
    past_value = 0
    next_value = initial_value
    bump_occurred = False
    
    while abs(past_value - next_value) > threshold:
        past_value = next_value
        numerator = np.sum(p * b / (1 + b * past_value))
        denominator = np.sum(-b**2 * p / (1 + b * past_value)**2)
        next_value = past_value - numerator/denominator
        
        if next_value < 0 and not bump_occurred:
            next_value = 0
            bump_occurred = True
    
    expected_value = np.exp(np.sum(p * np.log(1 + b * next_value)))
    
    return next_value, expected_value

def plot_kelly_landscape(odds: List[float], probabilities: List[float], optimal_f: float):
    """
    Create visualization of the Kelly Criterion optimization landscape.
    """
    x = np.linspace(0, min(1, optimal_f*2), 1000)
    y = [np.exp(np.sum(np.array(probabilities) * np.log(1 + np.array(odds) * f))) for f in x]
    
    plt.figure(figsize=(12, 6))
    plt.plot(x, y, 'b-', label='Expected Value')
    plt.axvline(x=optimal_f, color='r', linestyle='--', label=f'Optimal f = {optimal_f:.3f}')
    optimal_ev = np.exp(np.sum(np.array(probabilities) * np.log(1 + np.array(odds) * optimal_f)))
    plt.plot(optimal_f, optimal_ev, 'ro')
    
    # Add half Kelly line
    half_kelly = optimal_f * 0.5
    half_kelly_ev = np.exp(np.sum(np.array(probabilities) * np.log(1 + np.array(odds) * half_kelly)))
    plt.axvline(x=half_kelly, color='g', linestyle='--', label=f'Half Kelly f = {half_kelly:.3f}')
    plt.plot(half_kelly, half_kelly_ev, 'go')
    
    plt.title('Kelly Criterion Expected Value')
    plt.xlabel('Fraction of Bankroll (f)')
    plt.ylabel('Expected Value (exp of growth rate)')
    plt.grid(True)
    plt.legend()
    plt.show()

def calculate_growth_rate(f: float, odds: np.ndarray, probs: np.ndarray) -> float:
    """Calculate the expected growth rate for a given fraction."""
    return np.sum(probs * np.log(1 + odds * f))

def main():
    """Main function to run calculations."""
    print("Kelly Criterion Calculator")
    print("-------------------------")
    
    # Get number of outcomes
    n = int(input("Enter number of outcomes: "))
    
    odds = []
    probs = []
    
    # Get odds and probabilities for each outcome
    for i in range(n):
        print(f"\nOutcome {i+1}:")
        odd = float(input(f"Enter return for outcome {i+1} (e.g., -1 for loss, 2 for 2:1 return): "))
        prob = float(input(f"Enter probability for outcome {i+1} (e.g., 0.5 for 50%): "))
        odds.append(odd)
        probs.append(prob)
    
    # Calculate optimal fraction and expected value
    full_kelly, full_kelly_ev = kelly_criterion_newton(odds, probs)
    half_kelly = full_kelly * 0.5
    half_kelly_ev = np.exp(np.sum(np.array(probs) * np.log(1 + np.array(odds) * half_kelly)))
    
    print("\nResults:")
    print(f"Full Kelly fraction: {full_kelly:.4f}")
    print(f"Half Kelly fraction: {half_kelly:.4f}")
    print(f"Expected Value at Full Kelly: {full_kelly_ev:.4f}")
    print(f"Expected Value at Half Kelly: {half_kelly_ev:.4f}")
    
    # Show detailed calculation for verification
    print("\nDetailed Growth Rate Calculation for Full Kelly:")
    for i, (b, p) in enumerate(zip(odds, probs)):
        term = p * np.log(1 + b * full_kelly)
        print(f"Outcome {i+1}: p={p}, b={b}")
        print(f"  Term = {p} * ln(1 + {b} * {full_kelly:.4f}) = {term:.4f}")
    
    growth_rate = calculate_growth_rate(full_kelly, np.array(odds), np.array(probs))
    print(f"\nTotal growth rate (sum): {growth_rate:.4f}")
    print(f"Final EV = e^({growth_rate:.4f}) = {full_kelly_ev:.4f}")
    
    # Create visualization
    plot_kelly_landscape(odds, probs, full_kelly)
            
if __name__ == "__main__":
    main()
  