'use client';

import { useEffect } from 'react';

interface CrowdSprite extends Phaser.GameObjects.Sprite {
  outlineSprite?: Phaser.GameObjects.Sprite;
}

export default function GameComponent() {
  useEffect(() => {
    const initPhaser = async () => {
      const Phaser = (await import('phaser')).default;

      class CharacterScene extends Phaser.Scene {
        private body!: Phaser.GameObjects.Image;
        private head!: Phaser.GameObjects.Sprite;
        private hostText!: Phaser.GameObjects.Text;
        private djStand!: Phaser.GameObjects.Image;
        private vinyl!: Phaser.GameObjects.Sprite;
        private vinylLeft!: Phaser.GameObjects.Sprite;
        private vinylRight!: Phaser.GameObjects.Sprite;
        private background!: Phaser.GameObjects.Rectangle;
        private equalizers: Phaser.GameObjects.Sprite[] = [];
        private equalizerTimer!: Phaser.Time.TimerEvent;
        private readonly NUMBER_OF_EQUALIZERS = 5;
        private readonly EQUALIZER_SPACING = 300;
        private strobes: Phaser.GameObjects.Sprite[] = [];
        private strobeTimer!: Phaser.Time.TimerEvent;
        private characterTween!: Phaser.Tweens.Tween;
        private crowds: CrowdSprite[] = [];
        private readonly CROWD_SPACING = 600;

        // Add shared properties for responsive calculations
        private width!: number;
        private height!: number;
        private centerX!: number;
        private centerY!: number;
        private bodyOffset!: number;
        private headOffset!: number;
        private standY!: number;
        private spacingLeft!: number;
        private spacingRight!: number;
        private heightOffset!: number;
        private moveTowardsCenterOffset!: number;
        private additionalCenterOffset!: number;
        private fineAdjustmentOffset!: number;
        private personWidth!: number;
        private labelY!: number;
        private crowdY!: number;
        private crowdRow2Y!: number;
        private crowdRow3Y!: number;
        private characterScale!: number;
        private djStandScale!: number;
        private crowdScale!: number;
        private equalizerScale!: number;

        constructor() {
          super({ key: 'CharacterScene' });
        }

        preload() {
          this.load.image('body', '/assets/host/Body.png');
          this.load.spritesheet('head', '/assets/host/Head.png', {
            frameWidth: 24,
            frameHeight: 24
          });
          this.load.image('djstand', '/assets/host/DJ_Stand.png');
          
          this.load.spritesheet('vinyl', '/assets/host/Spinning_Vinyl_strip9.png', {
            frameWidth: 48,
            frameHeight: 24
          });

          // Load equalizer spritesheet
          this.load.spritesheet('equalizer', '/assets/effects/Equalizer_strip6.png', {
            frameWidth: 256,
            frameHeight: 192
          });

          // Load strobe effect spritesheet
          this.load.spritesheet('strobe', '/assets/effects/Blue_and_Red_Strobe_strip8.png', {
            frameWidth: 256,
            frameHeight: 192
          });

          // Load crowd silhouettes
          this.load.spritesheet('crowd_blue', '/assets/crowd/Male_Siloutte_DBlue_strip4.png', {
            frameWidth: 256,
            frameHeight: 96
          });
          this.load.spritesheet('crowd_pink', '/assets/crowd/Male_Siloutte_Pink_strip4.png', {
            frameWidth: 256,
            frameHeight: 96
          });
          this.load.spritesheet('crowd_lblue', '/assets/crowd/Male_Siloutte_LBlue_strip4.png', {
            frameWidth: 256,
            frameHeight: 96
          });
        }

        private updateResponsiveValues() {
          this.width = this.cameras.main.width;
          this.height = this.cameras.main.height;
          this.centerX = this.width / 2;
          this.centerY = this.height / 2;

          // Update all measurements relative to screen size
          this.bodyOffset = this.height * 0.2;
          this.headOffset = this.height * 0.07;
          this.standY = this.centerY - (this.height * 0.1);
          this.spacingLeft = this.width * 0.06;
          this.spacingRight = this.width * 0.06;
          this.heightOffset = this.height * 0.025;

          // Crowd positioning calculations - Increased horizontal spacing
          this.moveTowardsCenterOffset = this.width * 0.15; // Increased from 0.1 to 0.15
          this.additionalCenterOffset = this.width * 0.08; // Increased from 0.06 to 0.08
          this.fineAdjustmentOffset = this.width * 0.06; // Increased from 0.04 to 0.06
          this.personWidth = this.width * 0.05;

          // Label positioning
          this.labelY = this.centerY - (this.height * 0.3);
          this.crowdY = this.centerY + (this.height * 0.07);
          this.crowdRow2Y = this.centerY + (this.height * 0.22);
          this.crowdRow3Y = this.centerY + (this.height * 0.37);

          // Scaling calculations
          this.characterScale = Math.min(this.width, this.height) * 0.002;
          this.djStandScale = Math.min(this.width, this.height) * 0.0018;
          this.crowdScale = Math.min(this.width, this.height) * 0.002;
          this.equalizerScale = Math.min(this.width, this.height) * 0.0014;
        }

        create() {
          this.updateResponsiveValues();

          // Add black background first (before any other elements)
          this.background = this.add.rectangle(0, 0, this.width, this.height, 0x000000);
          this.background.setOrigin(0, 0);
          this.background.setDepth(-1);

          // Calculate base positions for crowds with unique names
          const initialBaseLeftX = (this.width / 4) + this.moveTowardsCenterOffset;
          const initialBaseRightX = ((this.width * 3) / 4) - this.moveTowardsCenterOffset;

          // Calculate final positions with all offsets
          const initialLeftSideX = initialBaseLeftX + this.additionalCenterOffset - this.fineAdjustmentOffset;
          const initialRightSideX = initialBaseRightX - this.additionalCenterOffset + this.fineAdjustmentOffset;

          // Create strobe animations with different speeds
          if (!this.anims.exists('strobe_effect_normal')) {
            this.anims.create({
              key: 'strobe_effect_normal',
              frames: this.anims.generateFrameNumbers('strobe', { 
                start: 0,
                end: 7
              }),
              frameRate: 12,
              repeat: -1
            });
          }

          if (!this.anims.exists('strobe_effect_fast')) {
            this.anims.create({
              key: 'strobe_effect_fast',
              frames: this.anims.generateFrameNumbers('strobe', { 
                start: 0,
                end: 7
              }),
              frameRate: 16,
              repeat: -1
            });
          }

          // Add multiple strobe sprites in different positions
          const strobePositions = [
            { x: this.centerX - 200, y: this.centerY - this.bodyOffset + 50, scale: 1.2 },
            { x: this.centerX + 200, y: this.centerY - this.bodyOffset + 50, scale: 1.2 },
            { x: this.centerX, y: this.centerY - this.bodyOffset, scale: 1.5 }
          ];

          strobePositions.forEach(pos => {
            const strobe = this.add.sprite(pos.x, pos.y, 'strobe');
            strobe.setScale(pos.scale);
            strobe.setBlendMode(Phaser.BlendModes.ADD);
            strobe.setAlpha(0.8);
            strobe.setDepth(-0.8); // Behind the DJ but in front of background
            this.strobes.push(strobe);
          });

          // Start random strobe animations
          this.randomizeStrobeEffects();
          
          // Set up timer to change strobe animations
          this.strobeTimer = this.time.addEvent({
            delay: 3000, // Change effects every 3 seconds
            callback: this.randomizeStrobeEffects,
            callbackScope: this,
            loop: true
          });

          // Create equalizer animations with different speeds
          if (!this.anims.exists('equalize_slow')) {
            this.anims.create({
              key: 'equalize_slow',
              frames: this.anims.generateFrameNumbers('equalizer', { 
                start: 0,
                end: 5
              }),
              frameRate: 8,
              repeat: -1
            });
          }

          if (!this.anims.exists('equalize_normal')) {
            this.anims.create({
              key: 'equalize_normal',
              frames: this.anims.generateFrameNumbers('equalizer', { 
                start: 0,
                end: 5
              }),
              frameRate: 12,
              repeat: -1
            });
          }

          if (!this.anims.exists('equalize_fast')) {
            this.anims.create({
              key: 'equalize_fast',
              frames: this.anims.generateFrameNumbers('equalizer', { 
                start: 0,
                end: 5
              }),
              frameRate: 16,
              repeat: -1
            });
          }

          // Add equalizer sprites - positioned horizontally behind the body
          const equalizerY = this.centerY - this.bodyOffset + 40; // Increased offset by 10px
          const totalWidth = this.EQUALIZER_SPACING * (this.NUMBER_OF_EQUALIZERS - 1);
          const startX = this.centerX - totalWidth / 2;

          for (let i = 0; i < this.NUMBER_OF_EQUALIZERS; i++) {
            const equalizer = this.add.sprite(
              startX + (i * this.EQUALIZER_SPACING),
              equalizerY,
              'equalizer'
            );
            equalizer.setScale(1.4);
            equalizer.setDepth(-0.8); // Move equalizers more to the back
            this.equalizers.push(equalizer);
          }
          
          // Start random animation changes for all equalizers
          this.randomizeEqualizerAnimation();
          
          // Set up timer to change animation randomly
          this.equalizerTimer = this.time.addEvent({
            delay: 2000, // Change animation every 2 seconds
            callback: this.randomizeEqualizerAnimation,
            callbackScope: this,
            loop: true
          });

          // Create and scale the DJ stand first
          this.djStand = this.add.image(this.centerX, this.centerY - 70, 'djstand');
          this.djStand.setOrigin(0.5);
          const djStandScale = 1.8;
          this.djStand.setScale(djStandScale);

          // Add crowd next to DJ Stand (left side)
          const djCrowdLeft = this.add.sprite(
            this.centerX - 450, // Left position
            this.centerY - 170, // Height position
            'crowd_blue'
          ) as CrowdSprite;
          djCrowdLeft.setScale(2.2);
          djCrowdLeft.setDepth(-0.4);
          djCrowdLeft.play('crowd_dance_blue');
          this.crowds.push(djCrowdLeft);

          // Add labels for left stage crowd
          const leftLabelStartX = this.centerX - 450 - (this.personWidth * 3);

          for (let i = 1; i <= 7; i++) {
            const personLabel = this.add.text(
              leftLabelStartX + (this.personWidth * (i-1)),
              this.labelY,
              `Orang ${i}`,
              {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                shadow: { color: '#000000', fill: true, blur: 2, offsetX: 1, offsetY: 1 }
              }
            );
            personLabel.setOrigin(0.5);
            personLabel.setDepth(999);
            
            // Add animation to each label
            this.tweens.add({
              targets: personLabel,
              y: '+=8',
              duration: 1000,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1
            });
          }

          // Add crowd next to DJ Stand (right side)
          const djCrowdRight = this.add.sprite(
            this.centerX + 450, // Symmetrical to the left crowd
            this.centerY - 170, // Same height as left crowd
            'crowd_blue'
          ) as CrowdSprite;
          djCrowdRight.setScale(2.2);
          djCrowdRight.setDepth(-0.4);
          djCrowdRight.play('crowd_dance_blue');
          this.crowds.push(djCrowdRight);

          // Add labels for right stage crowd
          const rightLabelStartX = this.centerX + 450 - (this.personWidth * 3);

          for (let i = 1; i <= 7; i++) {
            const personLabel = this.add.text(
              rightLabelStartX + (this.personWidth * (i-1)),
              this.labelY,
              `Orang ${i}`,
              {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                shadow: { color: '#000000', fill: true, blur: 2, offsetX: 1, offsetY: 1 }
              }
            );
            personLabel.setOrigin(0.5);
            personLabel.setDepth(999);
            
            // Add animation to each label
            this.tweens.add({
              targets: personLabel,
              y: '+=8',
              duration: 1000,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1
            });
          }

          // Create vinyl animation if it doesn't exist
          if (!this.anims.exists('spin')) {
            const frames = [];
            for (let i = 0; i < 9; i++) {
              frames.push({ key: 'vinyl', frame: i });
            }

            this.anims.create({
              key: 'spin',
              frames: frames,
              frameRate: 4,
              repeat: -1
            });
          }

          // Helper function to create and setup vinyl sprites
          const createVinyl = (x: number, y: number, scale: number = 1) => {
            const vinyl = this.add.sprite(x, y, 'vinyl', 0);
            vinyl.setOrigin(0.5);
            vinyl.setScale(scale);
            if (this.anims.exists('spin')) {
              vinyl.play('spin');
            }
            return vinyl;
          };

          // Positioning constants
          const vinylScale = 1.4;

          // Create vinyls
          this.vinylLeft = this.add.sprite(this.centerX - this.spacingLeft, this.standY - this.heightOffset, 'vinyl');
          this.vinylLeft.setScale(vinylScale);
          this.vinylLeft.play('spin');

          this.vinylRight = this.add.sprite(this.centerX + this.spacingRight, this.standY - this.heightOffset, 'vinyl');
          this.vinylRight.setScale(vinylScale);
          this.vinylRight.play('spin');

          this.vinyl = this.vinylLeft;

          // Character slightly higher
          this.body = this.add.image(this.centerX, this.centerY - this.bodyOffset, 'body');
          this.body.setOrigin(0.5);
          
          this.head = this.add.sprite(this.centerX, (this.centerY - this.bodyOffset) - this.headOffset, 'head', 0);
          this.head.setOrigin(0.5);

          const characterScale = 2.0;

          this.body.setScale(characterScale);
          this.head.setScale(characterScale);

          // Add HOST text with retro style
          this.hostText = this.add.text(this.centerX, (this.centerY - this.bodyOffset) - this.headOffset - 35, 'HOST', {
            fontFamily: 'Arial',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { color: '#ff00ff', fill: true, blur: 8, offsetX: 2, offsetY: 2 },
            padding: { x: 8, y: 8 }
          });
          this.hostText.setOrigin(0.5);

          // Add floating animation to character and text
          this.characterTween = this.tweens.add({
            targets: [this.body, this.head, this.hostText],
            y: '+=4',
            duration: 100,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
          });

          // Create crowd animation for both colors
          if (!this.anims.exists('crowd_dance_blue')) {
            this.anims.create({
              key: 'crowd_dance_blue',
              frames: this.anims.generateFrameNumbers('crowd_blue', { 
                start: 0,
                end: 3
              }),
              frameRate: 4,
              repeat: -1
            });
          }

          if (!this.anims.exists('crowd_dance_pink')) {
            this.anims.create({
              key: 'crowd_dance_pink',
              frames: this.anims.generateFrameNumbers('crowd_pink', { 
                start: 0,
                end: 3
              }),
              frameRate: 4,
              repeat: -1
            });
          }

          // Function to create labels with adjusted spacing
          const createCrowdLabels = (crowdX: number, crowdY: number, rowPrefix: string) => {
            // Calculate the total width of the crowd sprite
            const crowdWidth = 256 * this.crowdScale; // 256 is the sprite width
            
            // Adjust the total width for labels
            const totalLabelSpacing = crowdWidth * 1.1; // Changed to 1.1 for perfect spacing
            const labelStartX = crowdX - (totalLabelSpacing / 2);
            const labelSpacing = totalLabelSpacing / 6; // Space between each label
            
            const labels: Phaser.GameObjects.Text[] = [];

            for (let i = 1; i <= 7; i++) {
              const personLabel = this.add.text(
                labelStartX + ((i-1) * labelSpacing),
                crowdY - (crowdWidth * 0.27), // Adjusted to 0.27 for perfect height
                `${rowPrefix} ${i}`,
                {
                  fontFamily: 'Arial',
                  fontSize: `${Math.max(Math.min(this.width * 0.008, 12), 8)}px`,
                  color: '#ffffff',
                  stroke: '#000000',
                  strokeThickness: 2,
                  shadow: { 
                    color: '#000000',
                    fill: true,
                    blur: 1,
                    offsetX: 1,
                    offsetY: 1
                  }
                }
              );
              personLabel.setOrigin(0.5);
              personLabel.setDepth(999);

              this.tweens.add({
                targets: personLabel,
                y: '+=4',
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
              });
              
              labels.push(personLabel);
            }
            return labels;
          };

          // Create Row 1 (front row) - Blue silhouettes
          const leftCrowdRow1 = this.add.sprite(
            this.centerX - (this.width * 0.20),
            this.crowdY,
            'crowd_blue'
          ) as CrowdSprite;
          leftCrowdRow1.setScale(this.crowdScale);
          leftCrowdRow1.setDepth(-0.3);
          leftCrowdRow1.play('crowd_dance_blue');
          this.crowds.push(leftCrowdRow1);

          // Create labels immediately after each crowd
          const leftRow1Labels = createCrowdLabels(
            this.centerX - (this.width * 0.20),
            this.crowdY,
            'Orang'
          );

          const rightCrowdRow1 = this.add.sprite(
            this.centerX + (this.width * 0.20),
            this.crowdY,
            'crowd_blue'
          ) as CrowdSprite;
          rightCrowdRow1.setScale(this.crowdScale);
          rightCrowdRow1.setDepth(-0.3);
          rightCrowdRow1.play('crowd_dance_blue');
          this.crowds.push(rightCrowdRow1);

          const rightRow1Labels = createCrowdLabels(
            this.centerX + (this.width * 0.20),
            this.crowdY,
            'Orang'
          );

          // Create Row 2 (middle row) - Pink silhouettes
          const leftCrowdRow2 = this.add.sprite(
            this.centerX - (this.width * 0.20),
            this.crowdRow2Y,
            'crowd_pink'
          ) as CrowdSprite;
          leftCrowdRow2.setScale(this.crowdScale);
          leftCrowdRow2.setDepth(-0.2);
          leftCrowdRow2.play('crowd_dance_pink');
          this.crowds.push(leftCrowdRow2);

          const leftRow2Labels = createCrowdLabels(
            this.centerX - (this.width * 0.20),
            this.crowdRow2Y,
            'Orang'
          );

          const rightCrowdRow2 = this.add.sprite(
            this.centerX + (this.width * 0.20),
            this.crowdRow2Y,
            'crowd_pink'
          ) as CrowdSprite;
          rightCrowdRow2.setScale(this.crowdScale);
          rightCrowdRow2.setDepth(-0.2);
          rightCrowdRow2.play('crowd_dance_pink');
          this.crowds.push(rightCrowdRow2);

          const rightRow2Labels = createCrowdLabels(
            this.centerX + (this.width * 0.20),
            this.crowdRow2Y,
            'Orang'
          );

          // Create Row 3 (back row) - Light Blue silhouettes
          const leftCrowdRow3 = this.add.sprite(
            this.centerX - (this.width * 0.20),
            this.crowdRow3Y,
            'crowd_lblue'
          ) as CrowdSprite;
          leftCrowdRow3.setScale(this.crowdScale);
          leftCrowdRow3.setDepth(-0.1);
          leftCrowdRow3.play('crowd_dance_lblue');
          this.crowds.push(leftCrowdRow3);

          const leftRow3Labels = createCrowdLabels(
            this.centerX - (this.width * 0.20),
            this.crowdRow3Y,
            'Orang'
          );

          const rightCrowdRow3 = this.add.sprite(
            this.centerX + (this.width * 0.20),
            this.crowdRow3Y,
            'crowd_lblue'
          ) as CrowdSprite;
          rightCrowdRow3.setScale(this.crowdScale);
          rightCrowdRow3.setDepth(-0.1);
          rightCrowdRow3.play('crowd_dance_lblue');
          this.crowds.push(rightCrowdRow3);

          const rightRow3Labels = createCrowdLabels(
            this.centerX + (this.width * 0.20),
            this.crowdRow3Y,
            'Orang'
          );

          // Add slight up and down movement to all crowds
          this.crowds.forEach((crowd, index) => {
            const delay = Math.random() * 1000;
            
            // Add movement to crowd
            this.tweens.add({
              targets: [crowd, crowd.outlineSprite].filter(Boolean),
              y: '+=8',
              duration: 1000,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1,
              delay: delay
            });

            // Add movement to labels if it's the first crowd (left front)
            if (index === 0) {
              leftRow1Labels.forEach(label => {
                this.tweens.add({
                  targets: label,
                  y: '+=8',
                  duration: 1000,
                  ease: 'Sine.easeInOut',
                  yoyo: true,
                  repeat: -1,
                  delay: delay
                });
              });
            }
          });

          // Update scales di bagian yang relevan
          this.djStand.setScale(djStandScale);
          this.body.setScale(characterScale);
          this.head.setScale(characterScale);

          // Update crowd scales
          this.crowds.forEach(crowd => {
            crowd.setScale(2.2);
          });

          // Update equalizer scales
          this.equalizers.forEach(equalizer => {
            equalizer.setScale(1.4);
          });

          this.scale.on('resize', this.handleResize, this);
        }

        private handleResize(gameSize: Phaser.Structs.Size) {
          this.updateResponsiveValues();
          
          if (this.body && this.head && this.djStand) {
            // Stop existing tween before repositioning
            if (this.characterTween) {
              this.characterTween.stop();
              this.characterTween.remove();
            }

            // Update background size
            if (this.background) {
              this.background.setSize(this.width, this.height);
            }

            // Update positions using class properties
            this.body.setPosition(this.centerX, this.centerY - this.bodyOffset);
            this.head.setPosition(this.centerX, (this.centerY - this.bodyOffset) - this.headOffset);
            this.hostText.setPosition(this.centerX, (this.centerY - this.bodyOffset) - this.headOffset - 35);
            this.djStand.setPosition(this.centerX, this.standY);

            // Update scales
            this.body.setScale(this.characterScale);
            this.head.setScale(this.characterScale);
            this.djStand.setScale(this.djStandScale);

            // Update vinyl positions
            if (this.vinylLeft) {
              this.vinylLeft.setPosition(this.centerX - this.spacingLeft, this.standY - this.heightOffset);
            }
            if (this.vinylRight) {
              this.vinylRight.setPosition(this.centerX + this.spacingRight, this.standY - this.heightOffset);
            }

            // Restart floating animation
            this.characterTween = this.tweens.add({
              targets: [this.body, this.head, this.hostText],
              y: '+=4',
              duration: 300,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1
            });
          }

          // Update crowd positions with unique variable names
          if (this.crowds.length > 0) {
            const updatedBaseLeftX = (this.width / 4) + this.moveTowardsCenterOffset;
            const updatedBaseRightX = ((this.width * 3) / 4) - this.moveTowardsCenterOffset;
            
            const updatedLeftSideX = updatedBaseLeftX + this.additionalCenterOffset - this.fineAdjustmentOffset;
            const updatedRightSideX = updatedBaseRightX - this.additionalCenterOffset + this.fineAdjustmentOffset;
            
            this.crowds.forEach((crowd, index) => {
              const isRightSide = index % 2 === 1;
              const rowNumber = Math.floor(index / 2);
              const xPos = isRightSide ? updatedRightSideX : updatedLeftSideX;
              const yPos = this.centerY + (this.height * 0.07) + (rowNumber * (this.height * 0.15));
              
              crowd.setPosition(xPos, yPos);
              crowd.setScale(this.crowdScale);
            });
          }

          // Update equalizer positions and scales
          this.equalizers.forEach((equalizer, index) => {
            const totalWidth = this.EQUALIZER_SPACING * (this.NUMBER_OF_EQUALIZERS - 1);
            const startX = this.centerX - totalWidth / 2;
            equalizer.setPosition(startX + (index * this.EQUALIZER_SPACING), this.centerY - this.bodyOffset + 40);
            equalizer.setScale(this.equalizerScale);
          });
        }

        private randomizeEqualizerAnimation() {
          // Random animation selection
          const animations = ['equalize_slow', 'equalize_normal', 'equalize_fast'];
          
          this.equalizers.forEach(equalizer => {
            if (!equalizer) return;

            const randomAnim = animations[Math.floor(Math.random() * animations.length)];
            const randomDelay = Math.random() * 500; // 0-500ms delay
            const randomSpeed = 0.8 + Math.random() * 0.4; // 0.8-1.2 speed multiplier
            
            this.time.delayedCall(randomDelay, () => {
              if (equalizer) {
                equalizer.play(randomAnim);
                equalizer.anims.timeScale = randomSpeed;
              }
            });
          });
        }

        private randomizeStrobeEffects() {
          this.strobes.forEach(strobe => {
            // Random animation selection
            const animations = ['strobe_effect_normal', 'strobe_effect_fast'];
            const randomAnim = animations[Math.floor(Math.random() * animations.length)];
            
            // Random delay and alpha variation
            const randomDelay = Math.random() * 500;
            const randomAlpha = 0.6 + Math.random() * 0.4; // 0.6-1.0 alpha
            
            this.time.delayedCall(randomDelay, () => {
              if (strobe) {
                strobe.play(randomAnim);
                strobe.setAlpha(randomAlpha);
              }
            });
          });
        }

        shutdown() {
          if (this.equalizerTimer) {
            this.equalizerTimer.destroy();
          }
          if (this.strobeTimer) {
            this.strobeTimer.destroy();
          }
          if (this.characterTween) {
            this.characterTween.stop();
            this.characterTween.remove();
          }
        }
      }

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        scale: {
          mode: Phaser.Scale.RESIZE,
          parent: 'phaser-container',
          width: 1920,
          height: 1080,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          expandParent: true,
          min: {
            width: 1280,
            height: 720
          },
          max: {
            width: 1920,
            height: 1080
          }
        },
        backgroundColor: '#000000',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
          }
        },
        scene: CharacterScene,
        audio: {
          noAudio: true
        }
      };

      const game = new Phaser.Game(config);

      const resizeGame = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        game.scale.resize(width, height);
      };

      resizeGame();
      window.addEventListener('resize', resizeGame);

      return () => {
        window.removeEventListener('resize', resizeGame);
        game.destroy(true);
      };
    };

    initPhaser();
  }, []);

  return <div id="phaser-container" className="w-full h-full"></div>;
}