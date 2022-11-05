# PeopleDistributor
Program to distribute a given number of people into groups multiple times, 
so that the number of people that meet each other gets maximized.

It supports equal distribution of genders among groups, e.g.
x males and y females per group where the ratio of x/y stays constant
throughout the scrambling.

This code uses simulated annealing to maximize the number of contacts. 
It uses two different target functions to achieve this goal.

1) The total number of contacts occurring. Duplicate contacts are
obviously not counted. This number will be maximised. This works 
well for problem parameters that will not allow everyone to see everyone.
2) A penalty function that will be increased if any two people are in 
the same group more than once. E.g. if Alice and Bob are in the same
group 3 times, the penalty function will be increased by (3-1)^2 = 4
This penalty function will be minimized. This technique will work well
for problem parameters where everyone will be able to see everyone.

The output produced is currently in .csv format.

Comments explaining most of the implementation can be found in 
the "State.h" file.

This code was thrown together in a night to solve a concrete problem 
I had and isn't intented to be usable / expandable or anything yet.
I might improve the algorithm in the future and add some more options
to it. Also, a little gui facilitating the use might come at some point.
