num=[5, 10, 15, 20]
target=25
def twoSum(nums, target):
        """
        :type nums: List[int]
        :type target: int
        :rtype: List[int]
        """
        seen = []
    
        for i, current_num in enumerate(nums):
            complement = target - current_num
            
            # If the complement exists in our dictionary, we found our pair
            if complement in seen:
                return [seen.index(complement), i]

            # Otherwise, add the current number and its index to the dictionary
            seen.append(current_num)

        return "No two sum solution found"

print( twoSum(num, target))
