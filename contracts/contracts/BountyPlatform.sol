pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BountyPlatform is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 private _bountyIds;

    struct Bounty {
        uint256 id;
        address creator;
        string title;
        string description;
        string requirements;
        address rewardToken;
        uint256 rewardAmount;
        uint256 deadline;
        BountyStatus status;
        address winner;
        uint256 submissionCount;
        mapping(uint256 => Submission) submissions;
        mapping(address => bool) hasSubmitted;
    }

    struct Submission {
        uint256 id;
        address developer;
        string solutionUrl;
        string description;
        uint256 timestamp;
        bool isWinner;
    }

    enum BountyStatus {
        Active,
        Completed,
        Cancelled
    }

    mapping(uint256 => Bounty) public bounties;
    mapping(address => uint256[]) public userBounties;
    mapping(address => uint256[]) public userSubmissions;

    uint256 public platformFee = 250;
    address public feeRecipient;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        string title,
        address rewardToken,
        uint256 rewardAmount,
        uint256 deadline
    );

    event SubmissionCreated(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed developer,
        string solutionUrl
    );

    event BountyCompleted(
        uint256 indexed bountyId,
        address indexed winner,
        uint256 rewardAmount
    );

    event BountyCancelled(uint256 indexed bountyId);

    modifier bountyExists(uint256 _bountyId) {
        require(_bountyId > 0 && _bountyId <= _bountyIds, "Bounty does not exist");
        _;
    }

    modifier onlyBountyCreator(uint256 _bountyId) {
        require(bounties[_bountyId].creator == msg.sender, "Not the bounty creator");
        _;
    }

    modifier bountyActive(uint256 _bountyId) {
        require(bounties[_bountyId].status == BountyStatus.Active, "Bounty is not active");
        require(block.timestamp < bounties[_bountyId].deadline, "Bounty deadline has passed");
        _;
    }

    constructor(address _feeRecipient) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
    }

    function createBounty(
        string memory _title,
        string memory _description,
        string memory _requirements,
        address _rewardToken,
        uint256 _rewardAmount,
        uint256 _deadline
    ) external nonReentrant {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(_rewardAmount > 0, "Reward amount must be greater than 0");
        require(_deadline > block.timestamp, "Deadline must be in the future");

        _bountyIds++;
        uint256 newBountyId = _bountyIds;

        Bounty storage newBounty = bounties[newBountyId];
        newBounty.id = newBountyId;
        newBounty.creator = msg.sender;
        newBounty.title = _title;
        newBounty.description = _description;
        newBounty.requirements = _requirements;
        newBounty.rewardToken = _rewardToken;
        newBounty.rewardAmount = _rewardAmount;
        newBounty.deadline = _deadline;
        newBounty.status = BountyStatus.Active;
        newBounty.submissionCount = 0;

        userBounties[msg.sender].push(newBountyId);

        IERC20(_rewardToken).safeTransferFrom(msg.sender, address(this), _rewardAmount);

        emit BountyCreated(newBountyId, msg.sender, _title, _rewardToken, _rewardAmount, _deadline);
    }

    function submitSolution(
        uint256 _bountyId,
        string memory _solutionUrl,
        string memory _description
    ) external bountyExists(_bountyId) bountyActive(_bountyId) {
        require(bytes(_solutionUrl).length > 0, "Solution URL cannot be empty");
        require(!bounties[_bountyId].hasSubmitted[msg.sender], "Already submitted a solution");

        Bounty storage bounty = bounties[_bountyId];
        bounty.submissionCount++;
        
        uint256 submissionId = bounty.submissionCount;
        bounty.submissions[submissionId] = Submission({
            id: submissionId,
            developer: msg.sender,
            solutionUrl: _solutionUrl,
            description: _description,
            timestamp: block.timestamp,
            isWinner: false
        });

        bounty.hasSubmitted[msg.sender] = true;
        userSubmissions[msg.sender].push(_bountyId);

        emit SubmissionCreated(_bountyId, submissionId, msg.sender, _solutionUrl);
    }

    function selectWinner(uint256 _bountyId, uint256 _submissionId) 
        external 
        bountyExists(_bountyId) 
        onlyBountyCreator(_bountyId) 
        bountyActive(_bountyId) 
    {
        Bounty storage bounty = bounties[_bountyId];
        require(_submissionId > 0 && _submissionId <= bounty.submissionCount, "Invalid submission ID");
        
        Submission storage winningSubmission = bounty.submissions[_submissionId];
        require(winningSubmission.developer != address(0), "Submission does not exist");

        bounty.status = BountyStatus.Completed;
        bounty.winner = winningSubmission.developer;
        winningSubmission.isWinner = true;

        uint256 fee = (bounty.rewardAmount * platformFee) / 10000;
        uint256 developerReward = bounty.rewardAmount - fee;

        IERC20(bounty.rewardToken).safeTransfer(winningSubmission.developer, developerReward);
        if (fee > 0) {
            IERC20(bounty.rewardToken).safeTransfer(feeRecipient, fee);
        }

        emit BountyCompleted(_bountyId, winningSubmission.developer, developerReward);
    }

    function cancelBounty(uint256 _bountyId) 
        external 
        bountyExists(_bountyId) 
        onlyBountyCreator(_bountyId) 
    {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.Active, "Bounty is not active");

        bounty.status = BountyStatus.Cancelled;

        IERC20(bounty.rewardToken).safeTransfer(bounty.creator, bounty.rewardAmount);

        emit BountyCancelled(_bountyId);
    }

    function getBountyDetails(uint256 _bountyId) 
        external 
        view 
        bountyExists(_bountyId) 
        returns (
            uint256 id,
            address creator,
            string memory title,
            string memory description,
            string memory requirements,
            address rewardToken,
            uint256 rewardAmount,
            uint256 deadline,
            BountyStatus status,
            address winner,
            uint256 submissionCount
        ) 
    {
        Bounty storage bounty = bounties[_bountyId];
        return (
            bounty.id,
            bounty.creator,
            bounty.title,
            bounty.description,
            bounty.requirements,
            bounty.rewardToken,
            bounty.rewardAmount,
            bounty.deadline,
            bounty.status,
            bounty.winner,
            bounty.submissionCount
        );
    }

    function getSubmission(uint256 _bountyId, uint256 _submissionId) 
        external 
        view 
        bountyExists(_bountyId) 
        returns (
            uint256 id,
            address developer,
            string memory solutionUrl,
            string memory description,
            uint256 timestamp,
            bool isWinner
        ) 
    {
        require(_submissionId > 0 && _submissionId <= bounties[_bountyId].submissionCount, "Invalid submission ID");
        
        Submission storage submission = bounties[_bountyId].submissions[_submissionId];
        return (
            submission.id,
            submission.developer,
            submission.solutionUrl,
            submission.description,
            submission.timestamp,
            submission.isWinner
        );
    }

    function getUserBounties(address _user) external view returns (uint256[] memory) {
        return userBounties[_user];
    }

    function getUserSubmissions(address _user) external view returns (uint256[] memory) {
        return userSubmissions[_user];
    }

    function getTotalBounties() external view returns (uint256) {
        return _bountyIds;
    }

    function setPlatformFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1000, "Fee cannot exceed 10%");
        platformFee = _newFee;
    }

    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient address");
        feeRecipient = _newRecipient;
    }
} 